import { BrowserWindow } from 'electron'
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import type {
  BackupProgress,
  RemoteBackupItem,
  RemoteConfig,
  SyncResult,
  SyncStatus,
} from '@shared/types'
import { ERROR_CODES, type LocalizedError } from '@shared/errors'
import { AppError, toLocalizedError } from '../errors'
import { IpcChannels } from '@shared/ipc-channels'
import { getDataDir } from '../utils/paths'
import { getSetting, setSetting } from '../db/settings'
import {
  applyEncryptedBytes,
  buildRemote,
  encodeSnapshotBytes,
  loadRemoteConfig,
  peekBackupFile,
} from '.'
import type { BackupRemote, RemoteObject } from './remote/types'

/** Object key (relative to the remote root) where the manifest pointer lives. */
const MANIFEST_KEY = 'manifest.json'
/** Prefix under which `.aibackup` snapshots are stored. */
const BACKUPS_PREFIX = 'backups/'
/** Local subdir (under `data/backups/`) for pre-apply rollback copies. */
const ROLLBACK_DIR = 'auto-rollback'
/** Tolerance for the local-vs-remote timestamp comparison; protects against
 *  small clock skew between the device that uploaded and this device. */
const CLOCK_TOLERANCE_MS = 1_000

interface Manifest {
  latestBackupKey: string
  latestCreatedAt: string
  schemaVersion: 1
}

/**
 * Cloud-sync engine. Single source of truth for sync direction, retention,
 * and the progress/status push surface.
 *
 * Direction policy (last-writer-wins with a manifest pointer):
 *   - No remote manifest         → upload (first sync from this device).
 *   - No local change recorded   → download (this device is fresh).
 *   - Manifest exists but its createdAt is missing → upload.
 *   - |localChange − remoteCreatedAt| ≤ CLOCK_TOLERANCE_MS → noop.
 *   - localChange > remoteCreatedAt → upload.
 *   - else → download.
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
      hasRemoteConfigured: !!getSetting('backup.remote.type'),
      autoSyncIntervalMinutes: parseInt(getSetting('backup.autoSyncIntervalMinutes') ?? '0', 10),
    }
  }

  cancel(): void {
    this.currentAbort?.abort()
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
    const cfg = loadRemoteConfig()
    if (!cfg) throw new AppError(ERROR_CODES.BACKUP_REMOTE_NOT_CONFIGURED)

    this.syncing = true
    this.currentAbort = new AbortController()
    this.broadcastStatus(null)

    try {
      const remote = buildRemote(cfg)
      const localChange = parseIso(getSetting('backup.lastLocalChangeAt'))
      const password = getSetting('backup.syncPassphrase')
      if (!password) {
        throw new AppError(ERROR_CODES.BACKUP_FILE_INVALID, undefined, 'Sync passphrase missing')
      }

      const manifest = await this.fetchManifest(remote)
      const remoteCreated = manifest ? parseIso(manifest.latestCreatedAt) : null

      let result: SyncResult
      if (manifest === null) {
        result = await this.uploadFlow(remote, password, cfg)
      } else if (localChange === null) {
        result = await this.downloadFlow(remote, password, manifest)
      } else if (remoteCreated === null) {
        result = await this.uploadFlow(remote, password, cfg)
      } else if (Math.abs(localChange - remoteCreated) <= CLOCK_TOLERANCE_MS) {
        result = { direction: 'noop' }
      } else if (localChange > remoteCreated) {
        result = await this.uploadFlow(remote, password, cfg)
      } else {
        result = await this.downloadFlow(remote, password, manifest)
      }

      setSetting('backup.lastSyncedAt', new Date().toISOString())
      if (result.createdAt) setSetting('backup.lastRemoteSeenAt', result.createdAt)
      this.lastWarning = null
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
   * List `.aibackup` objects on the remote, augmented with header metadata
   * (createdAt, appVersion) where available. Capped peek to 50 entries to
   * keep the dialog responsive on remotes with hundreds of historical snapshots.
   */
  async listRemote(): Promise<RemoteBackupItem[]> {
    const cfg = loadRemoteConfig()
    if (!cfg) throw new AppError(ERROR_CODES.BACKUP_REMOTE_NOT_CONFIGURED)
    const remote = buildRemote(cfg)
    const objects = await remote.list(BACKUPS_PREFIX)
    const out: RemoteBackupItem[] = []
    for (const obj of objects) {
      let createdAt = obj.lastModified
      let appVersion = ''
      if (out.length < 50) {
        try {
          const bytes = await remote.get(obj.key)
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
      })
    }
    out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    return out
  }

  /** Restore a specific historical snapshot from the remote. */
  async restoreFromKey(key: string, password: string, mode: 'replace' | 'merge'): Promise<void> {
    const cfg = loadRemoteConfig()
    if (!cfg) throw new AppError(ERROR_CODES.BACKUP_REMOTE_NOT_CONFIGURED)
    const remote = buildRemote(cfg)
    this.progress({ phase: 'download' })
    const bytes = await remote.get(key)
    this.progress({ phase: 'decrypt' })
    this.writeRollback(bytes)
    this.progress({ phase: 'apply' })
    applyEncryptedBytes(bytes, password, mode)
    setSetting('backup.lastSyncedAt', new Date().toISOString())
    this.broadcastStatus(null)
  }

  // ---------- private helpers ----------

  private async fetchManifest(remote: BackupRemote): Promise<Manifest | null> {
    try {
      const bytes = await remote.get(MANIFEST_KEY)
      const text = new TextDecoder().decode(bytes)
      const m = JSON.parse(text) as Manifest
      if (m.schemaVersion !== 1) return null
      return m
    } catch (e) {
      if (e instanceof AppError && e.code === ERROR_CODES.BACKUP_REMOTE_NOT_FOUND) return null
      throw e
    }
  }

  private async uploadFlow(
    remote: BackupRemote,
    password: string,
    _cfg: RemoteConfig,
  ): Promise<SyncResult> {
    this.progress({ phase: 'collect' })
    const { bytes, createdAt } = encodeSnapshotBytes(password)
    if (this.currentAbort?.signal.aborted) throw new AppError(ERROR_CODES.BACKUP_CANCELLED)

    const key = `${BACKUPS_PREFIX}${safeKeyTimestamp(createdAt)}.aibackup`
    this.progress({ phase: 'upload' })
    await remote.put(key, bytes)

    // Manifest is written LAST so a mid-upload crash leaves the previous
    // (still-valid) manifest in place rather than a dangling pointer.
    const manifest: Manifest = {
      latestBackupKey: key,
      latestCreatedAt: createdAt,
      schemaVersion: 1,
    }
    await remote.put(MANIFEST_KEY, new TextEncoder().encode(JSON.stringify(manifest, null, 2)))

    this.progress({ phase: 'cleanup' })
    await this.pruneRemote(remote)
    return { direction: 'upload', createdAt }
  }

  private async downloadFlow(
    remote: BackupRemote,
    password: string,
    manifest: Manifest,
  ): Promise<SyncResult> {
    this.progress({ phase: 'download' })
    const bytes = await remote.get(manifest.latestBackupKey)
    if (this.currentAbort?.signal.aborted) throw new AppError(ERROR_CODES.BACKUP_CANCELLED)

    this.writeRollback(bytes)
    this.progress({ phase: 'decrypt' })
    this.progress({ phase: 'apply' })
    applyEncryptedBytes(bytes, password, 'replace')
    return { direction: 'download', createdAt: manifest.latestCreatedAt }
  }

  /**
   * Stash the encrypted bytes that were ABOUT to be applied, into
   * `data/backups/auto-rollback/`. If apply succeeds we keep them as a safety
   * net (rolling window of `backup.maxRetainedBackups`); if apply throws,
   * the user can recover by importing the rollback copy manually.
   */
  private writeRollback(latestBytes: Uint8Array): void {
    const dir = join(getDataDir(), 'backups', ROLLBACK_DIR)
    mkdirSync(dir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    writeFileSync(join(dir, `pre-apply-${stamp}.aibackup`), Buffer.from(latestBytes))
    this.pruneLocalRollbacks(dir)
  }

  private pruneLocalRollbacks(dir: string): void {
    const max = parseInt(getSetting('backup.maxRetainedBackups') ?? '5', 10)
    if (max <= 0) return
    if (!existsSync(dir)) return
    // Filenames embed an ISO timestamp; lexicographic descending == newest first.
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.aibackup'))
      .map((name) => ({ name, full: join(dir, name) }))
      .sort((a, b) => (a.name < b.name ? 1 : -1))
    for (const f of files.slice(max)) {
      try {
        rmSync(f.full, { force: true })
      } catch {
        /* tolerate — best-effort cleanup */
      }
    }
  }

  private async pruneRemote(remote: BackupRemote): Promise<void> {
    const max = parseInt(getSetting('backup.maxRetainedBackups') ?? '5', 10)
    if (max <= 0) return
    let objects: RemoteObject[] = []
    try {
      objects = await remote.list(BACKUPS_PREFIX)
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
        await remote.delete(o.key)
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
