import { BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import type {
  BackupProgress,
  BackupStatus,
  RemoteBackupItem,
  RemoteSyncStatus,
  RemoteType,
  SyncResult,
} from '@shared/types'
import { ERROR_CODES, type LocalizedError } from '@shared/errors'
import { AppError, toLocalizedError } from '../errors'
import { IpcChannels } from '@shared/ipc-channels'
import { getSetting, setSetting } from '../db/settings'
import {
  applyBackupBytes,
  buildRemote,
  encodeSnapshotBytes,
  loadEnabledRemote,
  loadRemoteConfig,
  peekBackupFile,
  writePreApplyRollback,
} from '.'
import type { BackupRemote, RemoteObject } from './remote/types'

const MANIFEST_KEY = 'manifest.json'
const BACKUPS_PREFIX = 'backups/'
const CLOCK_TOLERANCE_MS = 1_000
const MANIFEST_SCHEMA_VERSION = 1

interface Manifest {
  latestBackupKey: string
  latestCreatedAt: string
  schemaVersion: 1
}

interface RemoteState {
  timer: NodeJS.Timeout | null
  abort: AbortController | null
  isSyncing: boolean
  lastError: LocalizedError | null
  lastWarning: string | null
}

const REMOTE_TYPES: RemoteType[] = ['webdav', 's3']

/**
 * Per-remote cloud-sync engine.
 *
 * Each remote (WebDAV / S3) owns an independent state slot — its own timer,
 * AbortController, in-flight flag, and last-error/warning. The two destinations
 * never read or write each other's manifest or settings; running one does
 * not block running the other.
 *
 * Direction policy (per remote):
 *   - No manifest on this remote                                   → upload here.
 *   - No local change recorded                                     → download from this remote.
 *   - localChange ≥ remoteCreated − tolerance                      → upload here.
 *   - else                                                         → download from this remote.
 *
 * After a successful upload OR download, `backup.lastLocalChangeAt` (the only
 * field that must stay global because local data is one) is advanced to the
 * authoritative createdAt — but only if it's newer than what's already there.
 * Writes that arrived during the sync window MUST keep their later timestamp.
 */
class BackupSyncService {
  private remoteStates = new Map<RemoteType, RemoteState>()

  constructor() {
    for (const type of REMOTE_TYPES) {
      this.remoteStates.set(type, this.makeEmptyState())
    }
  }

  /** Boot entry — schedules every configured + enabled remote and runs catch-up. */
  start(): void {
    for (const type of REMOTE_TYPES) {
      this.scheduleAuto(type)
      this.maybeCatchUp(type)
    }
  }

  getStatus(): BackupStatus {
    return {
      lastLocalChangeAt: getSetting('backup.lastLocalChangeAt') ?? null,
      remotes: {
        webdav: this.getRemoteStatus('webdav'),
        s3: this.getRemoteStatus('s3'),
      },
    }
  }

  private getRemoteStatus(type: RemoteType): RemoteSyncStatus {
    const state = this.remoteStates.get(type)!
    const cfg = loadRemoteConfig(type)
    return {
      type,
      configured: cfg !== null,
      enabled: getSetting(`backup.remote.${type}.enabled`) !== 'false',
      isSyncing: state.isSyncing,
      lastSyncedAt: getSetting(`backup.remote.${type}.lastSyncedAt`) ?? null,
      lastRemoteSeenAt: getSetting(`backup.remote.${type}.lastRemoteSeenAt`) ?? null,
      lastError: state.lastError,
      lastWarning: state.lastWarning,
      autoSyncIntervalMinutes: parseInt(
        getSetting(`backup.remote.${type}.autoSyncIntervalMinutes`) ?? '0',
        10,
      ),
      maxRetainedBackups: parseInt(
        getSetting(`backup.remote.${type}.maxRetainedBackups`) ?? '5',
        10,
      ),
      hasPassphrase: !!getSetting(`backup.remote.${type}.passphrase`),
    }
  }

  syncCancel(type: RemoteType): void {
    this.remoteStates.get(type)?.abort?.abort()
  }

  setEnabled(type: RemoteType, enabled: boolean): void {
    setSetting(`backup.remote.${type}.enabled`, enabled ? 'true' : 'false')
    if (enabled) {
      this.scheduleAuto(type)
      this.maybeCatchUp(type)
    } else {
      const state = this.remoteStates.get(type)!
      if (state.timer) {
        clearInterval(state.timer)
        state.timer = null
      }
      // Don't abort an in-flight sync — let it finish naturally to avoid a
      // partial write. The user can hit Cancel manually if they need to stop now.
    }
    this.broadcastStatus()
  }

  /**
   * (Re)configure auto-sync timer for the given remote. Idempotent. Called at
   * boot, when `enabled` flips, and when the per-remote `autoSyncIntervalMinutes`
   * setting changes.
   */
  scheduleAuto(type: RemoteType): void {
    const state = this.remoteStates.get(type)!
    if (state.timer) {
      clearInterval(state.timer)
      state.timer = null
    }
    const cfg = loadEnabledRemote(type)
    if (!cfg) return
    const minutes = parseInt(getSetting(`backup.remote.${type}.autoSyncIntervalMinutes`) ?? '0', 10)
    if (minutes < 1) return
    const ms = minutes * 60 * 1000
    state.timer = setInterval(() => {
      this.syncNow(type).catch((e) => {
        // Auto-sync failures: don't toast, just remember for the badge.
        state.lastWarning = e instanceof Error ? e.message : String(e)
        state.lastError = toLocalizedError(e)
        this.broadcastStatus()
      })
    }, ms)
  }

  /**
   * Catch up on a sync if we've drifted past the configured window. Called
   * at boot and after `setEnabled(true)`. Fire-and-forget — failures route
   * through the per-remote warning surface.
   */
  private maybeCatchUp(type: RemoteType): void {
    const state = this.remoteStates.get(type)!
    if (state.isSyncing) return
    if (!loadEnabledRemote(type)) return
    const last = parseIso(getSetting(`backup.remote.${type}.lastSyncedAt`))
    if (last === null) return
    const minutes = parseInt(getSetting(`backup.remote.${type}.autoSyncIntervalMinutes`) ?? '0', 10)
    if (minutes < 1) return
    const intervalMs = minutes * 60 * 1000
    if (Date.now() - last < intervalMs) return
    this.syncNow(type).catch((e) => {
      state.lastWarning = e instanceof Error ? e.message : String(e)
      state.lastError = toLocalizedError(e)
      this.broadcastStatus()
    })
  }

  /** Single-remote sync round-trip. Throws on error (caller decides how to surface). */
  async syncNow(type: RemoteType): Promise<SyncResult> {
    const state = this.remoteStates.get(type)!
    if (state.isSyncing) throw new AppError(ERROR_CODES.BACKUP_BUSY)
    const cfg = loadEnabledRemote(type)
    if (!cfg) throw new AppError(ERROR_CODES.BACKUP_REMOTE_NOT_CONFIGURED)

    state.isSyncing = true
    state.abort = new AbortController()
    state.lastError = null
    this.broadcastStatus()

    let finalError: LocalizedError | null = null
    try {
      // Plaintext mode: empty/missing passphrase means upload/download as
      // unencrypted bytes. The codec emits `encryption.algo: 'none'`.
      const passwordRaw = getSetting(`backup.remote.${type}.passphrase`)
      const password: string | null = passwordRaw && passwordRaw.length > 0 ? passwordRaw : null

      const remote = buildRemote(cfg)
      const manifest = await this.fetchManifest(remote, state)

      const localChange = parseIso(getSetting('backup.lastLocalChangeAt'))
      let result: SyncResult
      if (!manifest) {
        result = await this.uploadFlow(type, remote, password)
      } else if (localChange === null) {
        result = await this.downloadFlow(type, remote, manifest, password)
      } else {
        const remoteCreated = parseIso(manifest.latestCreatedAt)
        if (remoteCreated === null) {
          result = await this.uploadFlow(type, remote, password)
        } else if (localChange >= remoteCreated - CLOCK_TOLERANCE_MS) {
          result = await this.uploadFlow(type, remote, password)
        } else {
          result = await this.downloadFlow(type, remote, manifest, password)
        }
      }

      // Advance lastLocalChangeAt only if newer — preserve any mid-sync edits.
      if (result.createdAt && (result.direction === 'upload' || result.direction === 'download')) {
        const current = parseIso(getSetting('backup.lastLocalChangeAt'))
        const next = parseIso(result.createdAt)
        if (next !== null && (current === null || next > current)) {
          setSetting('backup.lastLocalChangeAt', result.createdAt)
        }
      }
      setSetting(`backup.remote.${type}.lastSyncedAt`, new Date().toISOString())
      if (result.createdAt) {
        setSetting(`backup.remote.${type}.lastRemoteSeenAt`, result.createdAt)
      }
      return result
    } catch (e) {
      // Cancellation: report as a normal SyncResult (not an error) so UI can
      // distinguish user-cancelled from genuine failure.
      if (state.abort?.signal.aborted) {
        return { direction: 'cancelled' }
      }
      finalError = toLocalizedError(e)
      throw e
    } finally {
      state.isSyncing = false
      state.abort = null
      state.lastError = finalError
      this.broadcastStatus()
    }
  }

  /**
   * List `.aibackup` objects on a specific remote, augmented with header
   * metadata where available.
   */
  async listRemote(type: RemoteType): Promise<RemoteBackupItem[]> {
    const cfg = loadEnabledRemote(type)
    if (!cfg) throw new AppError(ERROR_CODES.BACKUP_REMOTE_NOT_CONFIGURED)
    const remote = buildRemote(cfg)
    const objects = await remote.list(BACKUPS_PREFIX, this.signalFor(type))
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
          const bytes = await remote.get(obj.key, this.signalFor(type))
          const meta = peekBackupFile(new TextDecoder().decode(bytes))
          createdAt = meta.createdAt
          appVersion = meta.appVersion
        } catch {
          /* tolerate */
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
    password: string | null,
    mode: 'replace' | 'merge',
  ): Promise<void> {
    const cfg = loadEnabledRemote(type)
    if (!cfg) throw new AppError(ERROR_CODES.BACKUP_REMOTE_NOT_CONFIGURED)
    const remote = buildRemote(cfg)
    this.progress(type, { phase: 'download' })
    const bytes = await remote.get(key, this.signalFor(type))
    this.progress(type, { phase: 'decrypt' })
    if (mode === 'replace') {
      try {
        writePreApplyRollback(password, type)
      } catch {
        /* best-effort */
      }
    }
    this.progress(type, { phase: 'apply' })
    applyBackupBytes(bytes, password, mode)
    setSetting(`backup.remote.${type}.lastSyncedAt`, new Date().toISOString())
    this.broadcastStatus()
  }

  // ---------- private helpers ----------

  private makeEmptyState(): RemoteState {
    return {
      timer: null,
      abort: null,
      isSyncing: false,
      lastError: null,
      lastWarning: null,
    }
  }

  private signalFor(type: RemoteType): AbortSignal | undefined {
    return this.remoteStates.get(type)?.abort?.signal
  }

  private async fetchManifest(remote: BackupRemote, state: RemoteState): Promise<Manifest | null> {
    try {
      const bytes = await remote.get(MANIFEST_KEY, state.abort?.signal)
      const text = new TextDecoder().decode(bytes)
      const m = JSON.parse(text) as Manifest
      // A manifest from a newer client must NOT be silently treated as "no
      // manifest" — overwriting it would lose the other device's pointer.
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

  private async uploadFlow(
    type: RemoteType,
    remote: BackupRemote,
    password: string | null,
  ): Promise<SyncResult> {
    const state = this.remoteStates.get(type)!
    this.progress(type, { phase: 'collect' })
    const { bytes, createdAt } = encodeSnapshotBytes(password)
    if (state.abort?.signal.aborted) throw new AppError(ERROR_CODES.BACKUP_CANCELLED)

    const key = `${BACKUPS_PREFIX}${safeKeyTimestamp(createdAt)}-${randomUUID()}.aibackup`
    const manifest: Manifest = {
      latestBackupKey: key,
      latestCreatedAt: createdAt,
      schemaVersion: MANIFEST_SCHEMA_VERSION,
    }
    const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2))

    this.progress(type, { phase: 'upload' })
    try {
      // Manifest is written LAST so a mid-upload crash leaves the previous
      // (still-valid) manifest in place rather than a dangling pointer.
      await remote.put(key, bytes, state.abort?.signal)
      await remote.put(MANIFEST_KEY, manifestBytes, state.abort?.signal)
      state.lastWarning = null
    } catch (e) {
      throw new AppError(
        ERROR_CODES.BACKUP_REMOTE_NETWORK,
        undefined,
        e instanceof Error ? e.message : String(e),
      )
    }

    this.progress(type, { phase: 'cleanup' })
    await this.pruneRemote(type, remote, state)
    return { direction: 'upload', createdAt }
  }

  private async downloadFlow(
    type: RemoteType,
    remote: BackupRemote,
    manifest: Manifest,
    password: string | null,
  ): Promise<SyncResult> {
    const state = this.remoteStates.get(type)!
    this.progress(type, { phase: 'download' })
    const bytes = await remote.get(manifest.latestBackupKey, state.abort?.signal)
    if (state.abort?.signal.aborted) throw new AppError(ERROR_CODES.BACKUP_CANCELLED)

    try {
      writePreApplyRollback(password, type)
    } catch {
      /* best-effort */
    }
    this.progress(type, { phase: 'decrypt' })
    this.progress(type, { phase: 'apply' })
    applyBackupBytes(bytes, password, 'replace')

    return { direction: 'download', createdAt: manifest.latestCreatedAt }
  }

  private async pruneRemote(
    type: RemoteType,
    remote: BackupRemote,
    state: RemoteState,
  ): Promise<void> {
    const max = parseInt(getSetting(`backup.remote.${type}.maxRetainedBackups`) ?? '5', 10)
    if (max <= 0) return
    let objects: RemoteObject[] = []
    try {
      objects = await remote.list(BACKUPS_PREFIX, state.abort?.signal)
    } catch (e) {
      state.lastWarning = `prune list failed: ${e instanceof Error ? e.message : String(e)}`
      return
    }
    const sorted = [...objects]
      .filter((o) => o.key.endsWith('.aibackup'))
      .sort((a, b) => (a.key < b.key ? 1 : -1))
    for (const o of sorted.slice(max)) {
      try {
        await remote.delete(o.key, state.abort?.signal)
      } catch {
        /* tolerate — leave for next prune attempt */
      }
    }
  }

  private progress(type: RemoteType, p: Omit<BackupProgress, 'type'>): void {
    const payload: BackupProgress = { type, ...p }
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IpcChannels.BACKUP_PROGRESS, payload)
    }
  }

  /**
   * Push a fresh BackupStatus to every renderer. Public so settings
   * side-effects can fire it after persisting a `backup.remote.*.*` change —
   * otherwise the renderer's cached `status` would lag behind the SQLite
   * value until the next sync runs.
   */
  broadcastStatus(): void {
    const status = this.getStatus()
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
