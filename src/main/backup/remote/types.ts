import { ERROR_CODES } from '@shared/errors'
import { AppError } from '../../errors'

export interface RemoteObject {
  /** Object key relative to the backup root (e.g. `backups/xxx.aibackup`). */
  key: string
  size: number
  /** ISO timestamp of the object's last modification on the remote. */
  lastModified: string
}

export interface BackupRemote {
  put(path: string, bytes: Uint8Array): Promise<void>
  get(path: string): Promise<Uint8Array>
  list(prefix: string): Promise<RemoteObject[]>
  delete(path: string): Promise<void>
  /** Returns null if the object doesn't exist (so callers can branch on "first sync"). */
  headLastModified(path: string): Promise<string | null>
}

/** Map a transport-layer error to a stable AppError code. Always throws. */
export function classifyRemoteError(status: number | null, raw: unknown): never {
  if (status === 401) throw new AppError(ERROR_CODES.BACKUP_REMOTE_AUTH)
  if (status === 403) throw new AppError(ERROR_CODES.BACKUP_REMOTE_FORBIDDEN)
  if (status === 404) throw new AppError(ERROR_CODES.BACKUP_REMOTE_NOT_FOUND)
  if (raw instanceof Error && /timeout|ECONNREFUSED|ENOTFOUND|EAI_AGAIN/i.test(raw.message)) {
    throw new AppError(ERROR_CODES.BACKUP_REMOTE_NETWORK, undefined, raw.message)
  }
  throw new AppError(
    ERROR_CODES.BACKUP_REMOTE_NETWORK,
    undefined,
    raw instanceof Error ? raw.message : String(raw),
  )
}

/** True iff the error indicates "object does not exist". */
export function isNotFound(e: unknown): boolean {
  return e instanceof AppError && e.code === ERROR_CODES.BACKUP_REMOTE_NOT_FOUND
}
