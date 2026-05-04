import { ERROR_CODES } from '@shared/errors'
import { AppError } from '../../errors'

export interface RemoteObject {
  /** Object key relative to the backup root (e.g. `backups/xxx.aibackup`). */
  key: string
  size: number
  /** ISO timestamp of the object's last modification on the remote. */
  lastModified: string
}

/**
 * All long-running methods accept an optional `AbortSignal` so the sync
 * service's cancel button can interrupt in-flight transfers — without it,
 * "cancel" would only take effect at the next await between operations.
 */
export interface BackupRemote {
  put(path: string, bytes: Uint8Array, signal?: AbortSignal): Promise<void>
  get(path: string, signal?: AbortSignal): Promise<Uint8Array>
  list(prefix: string, signal?: AbortSignal): Promise<RemoteObject[]>
  delete(path: string, signal?: AbortSignal): Promise<void>
  /** Returns null if the object doesn't exist (so callers can branch on "first sync"). */
  headLastModified(path: string, signal?: AbortSignal): Promise<string | null>
}

/** Map a transport-layer error to a stable AppError code. Always throws. */
export function classifyRemoteError(status: number | null, raw: unknown): never {
  // Surface user-cancellation as the dedicated code so the sync service can
  // distinguish it from genuine network failures.
  if (raw instanceof Error && (raw.name === 'AbortError' || /aborted/i.test(raw.message))) {
    throw new AppError(ERROR_CODES.BACKUP_CANCELLED)
  }
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
