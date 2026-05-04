import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import type { BackupRemote, RemoteObject } from './types'
import { classifyRemoteError } from './types'
import { ERROR_CODES } from '@shared/errors'
import { AppError } from '../../errors'

export interface S3Options {
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  /** Path-style addressing — true for MinIO/B2/most non-AWS S3 compatibles. */
  forcePathStyle: boolean
  /** Object key prefix inside the bucket (e.g. `aistudio-backup/`). */
  prefix: string
}

export class S3Remote implements BackupRemote {
  private client: S3Client

  constructor(private opts: S3Options) {
    this.client = new S3Client({
      endpoint: opts.endpoint,
      region: opts.region || 'auto',
      credentials: {
        accessKeyId: opts.accessKeyId,
        secretAccessKey: opts.secretAccessKey,
      },
      forcePathStyle: opts.forcePathStyle,
    })
  }

  private key(path: string): string {
    const p = (this.opts.prefix || '').replace(/^\/+|\/+$/g, '')
    const k = path.replace(/^\/+/, '')
    return p ? `${p}/${k}` : k
  }

  async put(path: string, bytes: Uint8Array, signal?: AbortSignal): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.opts.bucket,
          Key: this.key(path),
          Body: bytes,
          ContentType: 'application/octet-stream',
        }),
        { abortSignal: signal },
      )
    } catch (e) {
      mapAndThrow(e)
    }
  }

  async get(path: string, signal?: AbortSignal): Promise<Uint8Array> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.opts.bucket, Key: this.key(path) }),
        { abortSignal: signal },
      )
      if (!res.Body) throw new AppError(ERROR_CODES.BACKUP_REMOTE_NOT_FOUND)
      const arr = await res.Body.transformToByteArray()
      // transformToByteArray returns Uint8Array on Node.js; the type allows other
      // ArrayBufferView-like objects, so normalize defensively.
      return arr instanceof Uint8Array ? arr : new Uint8Array(arr)
    } catch (e) {
      mapAndThrow(e)
    }
  }

  async delete(path: string, signal?: AbortSignal): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.opts.bucket, Key: this.key(path) }),
        { abortSignal: signal },
      )
    } catch (e) {
      // Treat 404 as success.
      if (statusOf(e) === 404) return
      mapAndThrow(e)
    }
  }

  async headLastModified(path: string, signal?: AbortSignal): Promise<string | null> {
    try {
      const res = await this.client.send(
        new HeadObjectCommand({ Bucket: this.opts.bucket, Key: this.key(path) }),
        { abortSignal: signal },
      )
      return res.LastModified ? res.LastModified.toISOString() : null
    } catch (e) {
      if (statusOf(e) === 404) return null
      mapAndThrow(e)
    }
  }

  async list(prefix: string, signal?: AbortSignal): Promise<RemoteObject[]> {
    const fullPrefix = this.key(prefix)
    const out: RemoteObject[] = []
    try {
      let continuationToken: string | undefined
      do {
        const res = await this.client.send(
          new ListObjectsV2Command({
            Bucket: this.opts.bucket,
            Prefix: fullPrefix,
            ContinuationToken: continuationToken,
          }),
          { abortSignal: signal },
        )
        for (const obj of res.Contents ?? []) {
          if (!obj.Key) continue
          // Strip the bucket-level prefix so callers see relative paths.
          const stripped = this.opts.prefix
            ? obj.Key.replace(
                new RegExp('^' + escapeRegExp(this.opts.prefix.replace(/^\/+|\/+$/g, '')) + '/'),
                '',
              )
            : obj.Key
          out.push({
            key: stripped,
            size: obj.Size ?? 0,
            lastModified: obj.LastModified ? obj.LastModified.toISOString() : '',
          })
        }
        continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
      } while (continuationToken)
    } catch (e) {
      mapAndThrow(e)
    }
    return out
  }
}

/**
 * Extract the HTTP status code from an AWS SDK error. AWS SDK v3 places it on
 * `error.$metadata.httpStatusCode`; some lower-level errors expose `statusCode`
 * instead. As a last resort, inspect the error `name` since some 404/403 cases
 * land there before metadata is populated.
 */
function statusOf(e: unknown): number | null {
  if (typeof e !== 'object' || e === null) return null
  const meta = (e as { $metadata?: { httpStatusCode?: number } }).$metadata
  if (meta && typeof meta.httpStatusCode === 'number') return meta.httpStatusCode
  const sc = (e as { statusCode?: unknown }).statusCode
  if (typeof sc === 'number') return sc
  const name = (e as { name?: string }).name
  if (name === 'NotFound' || name === 'NoSuchKey' || name === 'NoSuchBucket') return 404
  if (name === 'AccessDenied') return 403
  if (name === 'InvalidAccessKeyId' || name === 'SignatureDoesNotMatch') return 401
  return null
}

function mapAndThrow(e: unknown): never {
  const status = statusOf(e)
  if (status === 404) throw new AppError(ERROR_CODES.BACKUP_REMOTE_NOT_FOUND)
  if (status === 403) throw new AppError(ERROR_CODES.BACKUP_REMOTE_FORBIDDEN)
  if (status === 401) throw new AppError(ERROR_CODES.BACKUP_REMOTE_AUTH)
  if (e instanceof Error && /Signature|InvalidAccessKeyId/i.test(e.message)) {
    throw new AppError(ERROR_CODES.BACKUP_REMOTE_AUTH, undefined, e.message)
  }
  classifyRemoteError(status, e)
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
