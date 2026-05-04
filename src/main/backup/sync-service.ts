import { BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import type {
  BackupProgress,
  RemoteBackupItem,
  RemoteConfig,
  RemoteType,
  SyncResult,
  SyncStatus,
} from '@shared/types'
import { ERROR_CODES, type LocalizedError } from '@shared/errors'
import { AppError, toLocalizedError } from '../errors'
import { IpcChannels } from '@shared/ipc-channels'
import { getSetting, setSetting } from '../db/settings'
import {
  applyEncryptedBytes,
  buildRemote,
  encodeSnapshotBytes,
  loadEnabledRemotes,
  peekBackupFile,
  writePreApplyRollback,
} from '.'
import type { BackupRemote, RemoteObject } from './remote/types'

/** Object key (relative to the remote root) where the manifest pointer lives. */
const MANIFEST_KEY = 'manifest.json'
/** Prefix under which `.aibackup` snapshots are stored. */
const BACKUPS_PREFIX = 'backups/'
/** Tolerance for the local-vs-remote timestamp comparison; protects against
 *  small clock skew between the device that uploaded and this device. */
const CLOCK_TOLERANCE_MS = 1_000
/** Manifest schema this client knows how to read. Newer values must abort
 *  the sync rather than be silently overwritten — see fetchManifest. */
const MANIFEST_SCHEMA_VERSION = 1

interface Manifest {
  latestBackupKey: string
  latestCreatedAt: string
  schemaVersion: 1
}

interface RemoteWithManifest {
  cfg: RemoteConfig
  remote: BackupRemote
  manifest: Manifest | null
  /** Network/auth error fetching the manifest; service treats as "no manifest"
   *  for direction purposes but records a warning so the user knows. */
  fetchError: string | null
}

/**
 * Cloud-sync engine. Single source of truth for sync direction, retention,
 * and the progress/status push surface.
 *
 * **Multi-remote semantics (mirror writes):**
 *   - Upload writes the *same* encrypted snapshot to every enabled remote;
 *     each remote's manifest is updated with the same `latestCreatedAt`.
 *   - Download reads each remote's manifest, picks the one with the freshest
 *     `latestCreatedAt`, applies it locally, then mirror-uploads the bytes
 *     to any lagging remote so they converge.
 *
 * Direction policy:
 *   - No remote configured                                  → throw NOT_CONFIGURED.
 *   - No manifest exists on any remote                      → upload to all.
 *   - No local change recorded                              → download from freshest, mirror to laggers.
 *   - localChange ≥ freshestRemoteCreated − tolerance       → upload to all (always re-upload when local
 *                                                             matches or exceeds remote — gives the user a
 *                                                             "force push" feel and ensures the cloud always
 *                                                             reflects the most recent local state).
 *   - else                                                  → download from freshest, mirror to laggers.
 *
 * After a successful upload OR download, `backup.lastLocalChangeAt` is
 * advanced to match the authoritative `createdAt` IF the snapshot is newer
 * than the currently-recorded local change time. The conditional advance is
 * deliberate: writes that arrived during the sync window (between
 * `collectSnapshot()` and the final `setSetting`) MUST keep their later
 * timestamp so the next sync still treats them as dirty. Without this guard,
 * mid-sync edits would be silently dropped from future syncs.
 *
 * The manifest is written LAST during upload so a crash mid-upload leaves
 * the previous manifest pointing at the previous-known-good snapshot.
 */
class BackupSyncService {
  private syncing = false
  private currentAbort: AbortController | null = null
  private timer: NodeJS.Timeout | null = null
  private lastWarning: string | null = null

  /** Read current settings + activity into a SyncStatus snapshot. */
  getStatus(): SyncStatus {
    return {
      isSyncing: this.syncing,
      lastLocalChangeAt: getSetting('backup.lastLocalChangeAt') ?? null,
      lastSyncedAt: getSetting('backup.lastSyncedAt') ?? null,
      lastRemoteSeenAt: getSetting('backup.lastRemoteSeenAt') ?? null,
      // `lastError` is transient — propagated via broadcastStatus, never persisted.
      lastError: null,
      lastWarning: this.lastWarning,
      hasRemoteConfigured: loadEnabledRemotes().length > 0,
      autoSyncIntervalMinutes: parseInt(getSetting('backup.autoSyncIntervalMinutes') ?? '0', 10),
    }
  }

  cancel(): void {
    this.currentAbort?.abort()
  }

  /** Convenience accessor — every remote call inside a sync should pass this. */
  private get signal(): AbortSignal | undefined {
    return this.currentAbort?.signal
  }

  /**
   * (Re)configure the auto-sync timer based on current settings. Called at
   * boot and again whenever `backup.autoSyncIntervalMinutes` changes via the
   * settings IPC. Values < 5 disable auto-sync (the UI's smallest option).
   */
  scheduleAuto(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    const minutes = parseInt(getSetting('backup.autoSyncIntervalMinutes') ?? '0', 10)
    if (minutes < 5) return
    const ms = minutes * 60 * 1000
    this.timer = setInterval(() => {
      this.syncNow().catch((e) => {
        // Auto-sync failures: don't toast, just remember for the badge.
        this.lastWarning = e instanceof Error ? e.message : String(e)
        this.broadcastStatus(toLocalizedError(e))
      })
    }, ms)
  }

  /** Single sync round-trip. Throws on error (caller decides how to surface). */
  async syncNow(): Promise<SyncResult> {
    if (this.syncing) throw new AppError(ERROR_CODES.BACKUP_BUSY)
    const enabled = loadEnabledRemotes()
    if (enabled.length === 0) throw new AppError(ERROR_CODES.BACKUP_REMOTE_NOT_CONFIGURED)

    this.syncing = true
    this.currentAbort = new AbortController()
    this.broadcastStatus(null)

    try {
      const password = getSetting('backup.syncPassphrase')
      if (!password) {
        throw new AppError(ERROR_CODES.BACKUP_PASSWORD_REQUIRED)
      }

      // Fetch each remote's manifest in parallel. Per-target failures are
      // tolerated (treat as "no manifest") so a single dead remote can't
      // block sync — but a future-version manifest from any remote MUST
      // abort the entire sync so we don't silently demote it.
      const targets: RemoteWithManifest[] = await Promise.all(
        enabled.map(async (cfg) => {
          const remote = buildRemote(cfg)
          try {
            const manifest = await this.fetchManifest(remote)
            return { cfg, remote, manifest, fetchError: null }
          } catch (e) {
            // Schema-too-new must propagate — overwriting a newer manifest
            // with our older schema would lose the other device's state.
            // Same for user cancellation, so the sync ends cleanly rather
            // than rolling on as if the manifest fetch had simply 404'd.
            if (
              e instanceof AppError &&
              (e.code === ERROR_CODES.BACKUP_SCHEMA_TOO_NEW ||
                e.code === ERROR_CODES.BACKUP_CANCELLED)
            ) {
              throw e
            }
            return {
              cfg,
              remote,
              manifest: null,
              fetchError: e instanceof Error ? e.message : String(e),
            }
          }
        }),
      )
      this.recordFetchWarnings(targets)

      const localChange = parseIso(getSetting('backup.lastLocalChangeAt'))
      const freshest = pickFreshest(targets)

      let result: SyncResult
      if (!freshest || !freshest.manifest) {
        // Nothing on any remote (or all manifest fetches failed) → upload everywhere.
        result = await this.uploadFlow(targets, password)
      } else if (localChange === null) {
        result = await this.downloadFlow(targets, freshest, password)
      } else {
        const remoteCreated = parseIso(freshest.manifest.latestCreatedAt)
        if (remoteCreated === null) {
          result = await this.uploadFlow(targets, password)
        } else if (localChange >= remoteCreated - CLOCK_TOLERANCE_MS) {
          // Local is at least as fresh as the freshest remote — always upload.
          // We don't optimize away "noop" cases anymore: the user explicitly
          // wants the cloud to always reflect the latest local state, even
          // if the bytes happen to be identical. Retention prunes old copies
          // so this doesn't unbound the version count.
          result = await this.uploadFlow(targets, password)
        } else {
          result = await this.downloadFlow(targets, freshest, password)
        }
      }

      // Advance lastLocalChangeAt to the authoritative createdAt of the just-
      // synced state — but only if it's newer than what's already there.
      // Writes made DURING the sync (after collectSnapshot ran) bumped the
      // dirty timestamp past `createdAt`; we must not regress it, otherwise
      // those edits silently never sync.
      if (result.createdAt && (result.direction === 'upload' || result.direction === 'download')) {
        const current = parseIso(getSetting('backup.lastLocalChangeAt'))
        const next = parseIso(result.createdAt)
        if (next !== null && (current === null || next > current)) {
          setSetting('backup.lastLocalChangeAt', result.createdAt)
        }
      }
      setSetting('backup.lastSyncedAt', new Date().toISOString())
      if (result.createdAt) setSetting('backup.lastRemoteSeenAt', result.createdAt)
      this.broadcastStatus(null)
      return result
    } catch (e) {
      // Cancellation: report as a normal SyncResult (not an error to the
      // caller) so the UI can distinguish user-cancelled from genuine failure.
      if (this.currentAbort?.signal.aborted) {
        const cancelled: SyncResult = { direction: 'cancelled' }
        this.broadcastStatus(null)
        return cancelled
      }
      this.broadcastStatus(toLocalizedError(e))
      throw e
    } finally {
      this.syncing = false
      this.currentAbort = null
    }
  }

  /**
   * List `.aibackup` objects on a specific remote, augmented with header
   * metadata (createdAt, appVersion) where available. We sort by key
   * descending FIRST (keys begin with an ISO timestamp, so this puts the
   * newest items first), then peek the top 50 entries — that way the
   * "Latest first" view in the history dialog gets accurate header data
   * for the entries the user is most likely to inspect, even when there
   * are hundreds of historical snapshots.
   */
  async listRemote(type: RemoteType): Promise<RemoteBackupItem[]> {
    const enabled = loadEnabledRemotes()
    const cfg = enabled.find((c) => c.type === type)
    if (!cfg) throw new AppError(ERROR_CODES.BACKUP_REMOTE_NOT_CONFIGURED)
    const remote = buildRemote(cfg)
    const objects = await remote.list(BACKUPS_PREFIX, this.signal)
    const sorted = [...objects]
      .filter((o) => o.key.endsWith('.aibackup'))
      .sort((a, b) => (a.key < b.key ? 1 : -1))
    const out: RemoteBackupItem[] = []
    for (let i = 0; i < sorted.length; i++) {
      const obj = sorted[i]
      let createdAt = obj.lastModified
      let appVersion = ''
      if (i < 50) {
        try {
          const bytes = await remote.get(obj.key, this.signal)
          const meta = peekBackupFile(new TextDecoder().decode(bytes))
          createdAt = meta.createdAt
          appVersion = meta.appVersion
        } catch {
          /* tolerate — leave the lastModified-derived createdAt in place */
        }
      }
      out.push({
        key: obj.key,
        size: obj.size,
        lastModified: obj.lastModified,
        createdAt,
        appVersion,
        remoteType: type,
      })
    }
    out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    return out
  }

  /** Restore a specific historical snapshot from a specific remote. */
  async restoreFromKey(
    type: RemoteType,
    key: string,
    password: string,
    mode: 'replace' | 'merge',
  ): Promise<void> {
    const enabled = loadEnabledRemotes()
    const cfg = enabled.find((c) => c.type === type)
    if (!cfg) throw new AppError(ERROR_CODES.BACKUP_REMOTE_NOT_CONFIGURED)
    const remote = buildRemote(cfg)
    this.progress({ phase: 'download' })
    const bytes = await remote.get(key, this.signal)
    this.progress({ phase: 'decrypt' })
    // Save the CURRENT local state before applying. The user supplied the
    // password to decrypt the remote snapshot; reuse it for the rollback so
    // the resulting file is decryptable with the same credential.
    if (mode === 'replace') {
      try {
        writePreApplyRollback(password)
      } catch {
        /* best-effort — proceed even if the safety net failed */
      }
    }
    this.progress({ phase: 'apply' })
    applyEncryptedBytes(bytes, password, mode)
    setSetting('backup.lastSyncedAt', new Date().toISOString())
    this.broadcastStatus(null)
  }

  // ---------- private helpers ----------

  private async fetchManifest(remote: BackupRemote): Promise<Manifest | null> {
    try {
      const bytes = await remote.get(MANIFEST_KEY, this.signal)
      const text = new TextDecoder().decode(bytes)
      const m = JSON.parse(text) as Manifest
      // A manifest from a newer client must NOT be silently treated as "no
      // manifest" — if we did, the next syncNow would happily overwrite it
      // with our schema-1 manifest and lose the other device's pointer.
      if (m.schemaVersion > MANIFEST_SCHEMA_VERSION) {
        throw new AppError(ERROR_CODES.BACKUP_SCHEMA_TOO_NEW)
      }
      if (m.schemaVersion !== MANIFEST_SCHEMA_VERSION) return null
      return m
    } catch (e) {
      if (e instanceof AppError && e.code === ERROR_CODES.BACKUP_REMOTE_NOT_FOUND) return null
      throw e
    }
  }

  /** Encode locally + write the same bytes/manifest to every target. */
  private async uploadFlow(targets: RemoteWithManifest[], password: string): Promise<SyncResult> {
    this.progress({ phase: 'collect' })
    const { bytes, createdAt } = encodeSnapshotBytes(password)
    if (this.currentAbort?.signal.aborted) throw new AppError(ERROR_CODES.BACKUP_CANCELLED)

    // UUID suffix prevents key collisions when two devices upload within the
    // same millisecond — without it, the later writer overwrites the
    // earlier writer's snapshot bytes and that snapshot is lost forever.
    const key = `${BACKUPS_PREFIX}${safeKeyTimestamp(createdAt)}-${randomUUID()}.aibackup`
    const manifest: Manifest = {
      latestBackupKey: key,
      latestCreatedAt: createdAt,
      schemaVersion: MANIFEST_SCHEMA_VERSION,
    }
    const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2))

    this.progress({ phase: 'upload' })
    const failures = await this.writeToTargets(targets, key, bytes, manifestBytes)
    // Best-effort retention pruning per remote — failures here are warnings, not errors.
    this.progress({ phase: 'cleanup' })
    for (const t of targets) {
      if (failures.has(t.cfg.type)) continue
      await this.pruneRemote(t.remote)
    }
    if (failures.size === targets.length) {
      // Every remote failed — surface as a hard error.
      const msg = [...failures.values()].join('; ')
      throw new AppError(ERROR_CODES.BACKUP_REMOTE_NETWORK, undefined, msg)
    }
    return { direction: 'upload', createdAt }
  }

  private async downloadFlow(
    targets: RemoteWithManifest[],
    source: RemoteWithManifest,
    password: string,
  ): Promise<SyncResult> {
    if (!source.manifest) throw new AppError(ERROR_CODES.BACKUP_REMOTE_NOT_FOUND)
    this.progress({ phase: 'download' })
    const bytes = await source.remote.get(source.manifest.latestBackupKey, this.signal)
    if (this.currentAbort?.signal.aborted) throw new AppError(ERROR_CODES.BACKUP_CANCELLED)

    // Save the CURRENT local state (not the to-be-applied bytes) so the user
    // can actually undo this download by importing the rollback file. Encrypt
    // with the same password that just decrypted the remote so they remain
    // recoverable with one credential.
    try {
      writePreApplyRollback(password)
    } catch {
      /* best-effort — proceed with download even if the safety net failed */
    }
    this.progress({ phase: 'decrypt' })
    this.progress({ phase: 'apply' })
    applyEncryptedBytes(bytes, password, 'replace')

    // Mirror to laggers so they converge with the source's snapshot.
    const lagging = targets.filter((t) => t !== source && isLagging(t, source))
    if (lagging.length > 0) {
      const key = source.manifest.latestBackupKey
      const manifestBytes = new TextEncoder().encode(JSON.stringify(source.manifest, null, 2))
      this.progress({ phase: 'upload' })
      await this.writeToTargets(lagging, key, bytes, manifestBytes)
    }
    return { direction: 'download', createdAt: source.manifest.latestCreatedAt }
  }

  /**
   * Write the snapshot bytes followed by the manifest to each target. Returns
   * a map of `RemoteType → error message` for any that failed; the manifest
   * for failed targets is NOT written, so the next sync will re-attempt
   * cleanly.
   */
  private async writeToTargets(
    targets: RemoteWithManifest[],
    key: string,
    bytes: Uint8Array,
    manifestBytes: Uint8Array,
  ): Promise<Map<RemoteType, string>> {
    const failures = new Map<RemoteType, string>()
    await Promise.all(
      targets.map(async (t) => {
        try {
          await t.remote.put(key, bytes, this.signal)
          // Manifest is written LAST so a mid-upload crash leaves the previous
          // (still-valid) manifest in place rather than a dangling pointer.
          await t.remote.put(MANIFEST_KEY, manifestBytes, this.signal)
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          failures.set(t.cfg.type, `${t.cfg.type}: ${msg}`)
        }
      }),
    )
    if (failures.size > 0) {
      this.lastWarning = [...failures.values()].join('; ')
    } else {
      this.lastWarning = null
    }
    return failures
  }

  private recordFetchWarnings(targets: RemoteWithManifest[]): void {
    const errs = targets.filter((t) => t.fetchError).map((t) => `${t.cfg.type}: ${t.fetchError}`)
    if (errs.length > 0) this.lastWarning = errs.join('; ')
  }

  private async pruneRemote(remote: BackupRemote): Promise<void> {
    const max = parseInt(getSetting('backup.maxRetainedBackups') ?? '5', 10)
    if (max <= 0) return
    let objects: RemoteObject[] = []
    try {
      objects = await remote.list(BACKUPS_PREFIX, this.signal)
    } catch (e) {
      // Pruning is best-effort; record but don't fail the sync.
      this.lastWarning = `prune list failed: ${e instanceof Error ? e.message : String(e)}`
      return
    }
    const sorted = [...objects]
      .filter((o) => o.key.endsWith('.aibackup'))
      .sort((a, b) => (a.key < b.key ? 1 : -1))
    for (const o of sorted.slice(max)) {
      try {
        await remote.delete(o.key, this.signal)
      } catch {
        /* tolerate — leave for next prune attempt */
      }
    }
  }

  private progress(p: BackupProgress): void {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IpcChannels.BACKUP_PROGRESS, p)
    }
  }

  private broadcastStatus(err: LocalizedError | null): void {
    const status: SyncStatus = { ...this.getStatus(), lastError: err }
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IpcChannels.BACKUP_STATUS_CHANGED, status)
    }
  }
}

/** Pick the target whose manifest has the freshest `latestCreatedAt`. */
function pickFreshest(targets: RemoteWithManifest[]): RemoteWithManifest | null {
  let best: RemoteWithManifest | null = null
  let bestT = -Infinity
  for (const t of targets) {
    if (!t.manifest) continue
    const ts = parseIso(t.manifest.latestCreatedAt)
    if (ts !== null && ts > bestT) {
      best = t
      bestT = ts
    }
  }
  return best
}

/** A target is "lagging" if it has no manifest or its createdAt is older than the source's. */
function isLagging(target: RemoteWithManifest, source: RemoteWithManifest): boolean {
  if (!source.manifest) return false
  if (!target.manifest) return true
  const sT = parseIso(source.manifest.latestCreatedAt)
  const tT = parseIso(target.manifest.latestCreatedAt)
  if (sT === null || tT === null) return false
  return tT < sT - CLOCK_TOLERANCE_MS
}

function parseIso(s: string | null | undefined): number | null {
  if (!s) return null
  const t = Date.parse(s)
  return Number.isFinite(t) ? t : null
}

/** S3/WebDAV object keys must avoid `:` — replace ISO punctuation with `-`. */
function safeKeyTimestamp(iso: string): string {
  return iso.replace(/[:.]/g, '-')
}

export const backupSyncService = new BackupSyncService()
