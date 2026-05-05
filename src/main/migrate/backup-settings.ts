import { deleteSetting, getSetting, setSetting } from '../db/settings'
import type { RemoteType } from '@shared/types'

const REMOTE_TYPES: RemoteType[] = ['webdav', 's3']

/**
 * One-shot, idempotent migration of legacy global backup keys to per-remote
 * keys. Runs on every boot — but does work only the first time after upgrade.
 *
 * Strategy:
 *   - For each old shared key, copy to BOTH per-remote keys IF target is unset.
 *   - For each remote that has credentials saved, default `enabled = 'true'`
 *     IF the enabled key is unset (preserves prior behavior where configured
 *     = enabled).
 *   - Delete the old shared keys at the end.
 *
 * The "only copy when target is unset" guard makes a re-run after the user
 * has already changed per-remote values a no-op (won't clobber).
 */
export function migrateBackupSettings(): void {
  const oldInterval = getSetting('backup.autoSyncIntervalMinutes')
  const oldMaxRetained = getSetting('backup.maxRetainedBackups')
  const oldLastSynced = getSetting('backup.lastSyncedAt')
  const oldLastRemoteSeen = getSetting('backup.lastRemoteSeenAt')

  for (const type of REMOTE_TYPES) {
    if (oldInterval && !getSetting(`backup.remote.${type}.autoSyncIntervalMinutes`)) {
      setSetting(`backup.remote.${type}.autoSyncIntervalMinutes`, oldInterval)
    }
    if (oldMaxRetained && !getSetting(`backup.remote.${type}.maxRetainedBackups`)) {
      setSetting(`backup.remote.${type}.maxRetainedBackups`, oldMaxRetained)
    }
    if (oldLastSynced && !getSetting(`backup.remote.${type}.lastSyncedAt`)) {
      setSetting(`backup.remote.${type}.lastSyncedAt`, oldLastSynced)
    }
    if (oldLastRemoteSeen && !getSetting(`backup.remote.${type}.lastRemoteSeenAt`)) {
      setSetting(`backup.remote.${type}.lastRemoteSeenAt`, oldLastRemoteSeen)
    }

    if (hasRemoteCredentials(type) && getSetting(`backup.remote.${type}.enabled`) === undefined) {
      setSetting(`backup.remote.${type}.enabled`, 'true')
    }
  }

  if (oldInterval !== undefined) deleteSetting('backup.autoSyncIntervalMinutes')
  if (oldMaxRetained !== undefined) deleteSetting('backup.maxRetainedBackups')
  if (oldLastSynced !== undefined) deleteSetting('backup.lastSyncedAt')
  if (oldLastRemoteSeen !== undefined) deleteSetting('backup.lastRemoteSeenAt')
}

/**
 * Whether a remote has its core credentials saved. Sufficient to decide
 * whether to default `enabled = true`.
 */
function hasRemoteCredentials(type: RemoteType): boolean {
  if (type === 'webdav') {
    return !!getSetting('backup.remote.webdav.url')
  }
  return !!getSetting('backup.remote.s3.endpoint')
}
