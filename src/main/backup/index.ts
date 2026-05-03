import { dialog, BrowserWindow } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import type {
  BackupFileMeta,
  BackupImportMode,
  BackupProgress,
  BackupSummary,
  RemoteConfig,
  RollbackBackupItem,
} from '@shared/types'
import { ERROR_CODES } from '@shared/errors'
import { AppError } from '../errors'
import { IpcChannels } from '@shared/ipc-channels'
import { decodeBackupFile, encodeBackupFile, peekBackupFile } from './codec'
import { applySnapshot, collectSnapshot } from './snapshot'
import { getDb } from '../db/database'
import { getSetting, setSetting } from '../db/settings'
import { WebDAVRemote } from './remote/webdav'
import { S3Remote } from './remote/s3'
import type { BackupRemote } from './remote/types'
import { getDataDir } from '../utils/paths'

function broadcast(progress: BackupProgress): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IpcChannels.BACKUP_PROGRESS, progress)
  }
}

export interface ExportResult {
  filePath: string
}

/** Show a save dialog, then write the encrypted backup file. */
export async function exportToFile(password: string): Promise<ExportResult> {
  if (!password || password.length < 1) {
    throw new AppError(ERROR_CODES.BACKUP_FILE_INVALID, undefined, 'Empty password')
  }
  broadcast({ phase: 'collect' })
  const snapshot = collectSnapshot()
  broadcast({ phase: 'encrypt' })
  const json = encodeBackupFile(snapshot, password)

  const defaultName = `aistudio-backup-${snapshot.exportedAt.replace(/[:.]/g, '-')}.aibackup`
  const result = await dialog.showSaveDialog({
    title: 'Export AI Studio backup',
    defaultPath: defaultName,
    filters: [{ name: 'AI Studio Backup', extensions: ['aibackup'] }],
  })
  if (result.canceled || !result.filePath) {
    throw new AppError(ERROR_CODES.BACKUP_CANCELLED)
  }
  let outPath = result.filePath
  if (!outPath.toLowerCase().endsWith('.aibackup')) outPath = outPath + '.aibackup'
  await writeFile(outPath, json, 'utf8')
  return { filePath: outPath }
}

/** Read the plaintext header without decrypting. */
export async function peekFile(filePath: string): Promise<BackupFileMeta> {
  const raw = await readFile(filePath, 'utf8')
  return peekBackupFile(raw)
}

/** Decrypt + apply a backup file to the local DB. */
export async function importFromFile(
  filePath: string,
  password: string,
  mode: BackupImportMode,
): Promise<BackupSummary> {
  broadcast({ phase: 'decrypt' })
  const raw = await readFile(filePath, 'utf8')
  const snapshot = decodeBackupFile(raw, password)
  broadcast({ phase: 'apply' })
  try {
    return applySnapshot(snapshot, mode)
  } catch (e) {
    if (e instanceof AppError) throw e
    throw new AppError(
      ERROR_CODES.BACKUP_APPLY_FAILED,
      undefined,
      e instanceof Error ? e.message : String(e),
    )
  }
}

/** Helper for the cloud sync flow — produce the encrypted bytes without touching disk. */
export function encodeSnapshotBytes(password: string): { bytes: Uint8Array; createdAt: string } {
  const snapshot = collectSnapshot()
  const json = encodeBackupFile(snapshot, password)
  return { bytes: new TextEncoder().encode(json), createdAt: snapshot.exportedAt }
}

/** Helper for the cloud sync flow — apply a snapshot from in-memory bytes. */
export function applyEncryptedBytes(
  bytes: Uint8Array,
  password: string,
  mode: BackupImportMode,
): BackupSummary {
  const json = new TextDecoder().decode(bytes)
  const snapshot = decodeBackupFile(json, password)
  return applySnapshot(snapshot, mode)
}

// Re-exports so tests / future code can reach internals through one entry.
export { collectSnapshot, applySnapshot } from './snapshot'
export { peekBackupFile } from './codec'

// ---------------------------------------------------------------------------
// Remote-config persistence + factory
// ---------------------------------------------------------------------------

/**
 * Load the cloud-backup remote config from settings.
 *
 * Layout:
 * - `backup.remote.type` ∈ `'webdav' | 's3'` selects the variant.
 * - `backup.remote.config` is a JSON blob with the non-sensitive fields.
 * - Sensitive fields (`password` / `secretAccessKey`) live in dedicated keys
 *   so `SENSITIVE_KEYS` encrypts them via `safeStorage`.
 *
 * Returns `null` when no remote is configured (so callers can branch on
 * "first sync" vs. configured).
 */
export function loadRemoteConfig(): RemoteConfig | null {
  const type = getSetting('backup.remote.type')
  if (type !== 'webdav' && type !== 's3') return null
  const cfgRaw = getSetting('backup.remote.config')
  if (!cfgRaw) return null
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(cfgRaw)
  } catch {
    return null
  }
  if (type === 'webdav') {
    return {
      type: 'webdav',
      url: String(parsed.url ?? ''),
      username: String(parsed.username ?? ''),
      password: getSetting('backup.remote.password') ?? '',
      subPath: String(parsed.subPath ?? ''),
    }
  }
  return {
    type: 's3',
    endpoint: String(parsed.endpoint ?? ''),
    region: String(parsed.region ?? 'auto'),
    bucket: String(parsed.bucket ?? ''),
    accessKeyId: String(parsed.accessKeyId ?? ''),
    secretAccessKey: getSetting('backup.remote.secretAccessKey') ?? '',
    forcePathStyle: parsed.forcePathStyle === true,
    prefix: String(parsed.prefix ?? ''),
  }
}

export function saveRemoteConfig(cfg: RemoteConfig): void {
  if (cfg.type === 'webdav') {
    setSetting('backup.remote.type', 'webdav')
    setSetting(
      'backup.remote.config',
      JSON.stringify({ url: cfg.url, username: cfg.username, subPath: cfg.subPath }),
    )
    setSetting('backup.remote.password', cfg.password)
  } else {
    setSetting('backup.remote.type', 's3')
    setSetting(
      'backup.remote.config',
      JSON.stringify({
        endpoint: cfg.endpoint,
        region: cfg.region,
        bucket: cfg.bucket,
        accessKeyId: cfg.accessKeyId,
        forcePathStyle: cfg.forcePathStyle,
        prefix: cfg.prefix,
      }),
    )
    setSetting('backup.remote.secretAccessKey', cfg.secretAccessKey)
  }
}

export function clearRemoteConfig(): void {
  const db = getDb()
  db.prepare(`DELETE FROM settings WHERE key LIKE 'backup.remote.%'`).run()
}

export function buildRemote(cfg: RemoteConfig): BackupRemote {
  if (cfg.type === 'webdav') {
    return new WebDAVRemote({
      url: cfg.url,
      username: cfg.username,
      password: cfg.password,
      subPath: cfg.subPath,
    })
  }
  return new S3Remote({
    endpoint: cfg.endpoint,
    region: cfg.region,
    bucket: cfg.bucket,
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    forcePathStyle: cfg.forcePathStyle,
    prefix: cfg.prefix,
  })
}

/** Probe the remote with a tiny PUT/GET/DELETE round-trip. */
export async function testRemote(cfg: RemoteConfig): Promise<{ ok: boolean; latency: number }> {
  const remote = buildRemote(cfg)
  const probeKey = `aistudio-probe-${Date.now()}.txt`
  const start = Date.now()
  await remote.put(probeKey, new TextEncoder().encode('aistudio-probe'))
  await remote.get(probeKey)
  await remote.delete(probeKey).catch(() => {
    /* best-effort */
  })
  return { ok: true, latency: Date.now() - start }
}

// ---------------------------------------------------------------------------
// Local rollback copies
// ---------------------------------------------------------------------------

const ROLLBACK_FILENAME_RE = /^pre-apply-(.+)\.aibackup$/
const SAFE_ISO_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/

/**
 * Reverse the `safeKeyTimestamp` transform applied when writing rollback
 * files: `2026-05-03T15-30-12-345Z` → `2026-05-03T15:30:12.345Z`. Returns
 * undefined if the input doesn't match the expected pattern (so the caller
 * can fall back to file mtime).
 */
function parseRollbackTimestamp(safe: string): string | undefined {
  const m = SAFE_ISO_RE.exec(safe)
  if (!m) return undefined
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.${m[7]}Z`
  const t = Date.parse(iso)
  return Number.isFinite(t) ? new Date(t).toISOString() : undefined
}

/**
 * List local pre-apply rollback snapshots. Returns newest-first. Empty array
 * if the directory doesn't exist yet (no sync has ever run).
 *
 * Each item carries the absolute `filePath` so callers can hand it to
 * `importFromFile()` directly — no separate "restore from rollback" handler
 * is needed.
 */
export function listRollbacks(): RollbackBackupItem[] {
  const dir = join(getDataDir(), 'backups', 'auto-rollback')
  if (!existsSync(dir)) return []

  const out: RollbackBackupItem[] = []
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.aibackup')) continue
    const full = join(dir, name)

    let size = 0
    let createdAt = ''
    try {
      const stat = statSync(full)
      size = stat.size
      const m = ROLLBACK_FILENAME_RE.exec(name)
      createdAt = (m && parseRollbackTimestamp(m[1])) ?? stat.mtime.toISOString()
    } catch {
      /* tolerate; entry will still be returned with size 0 */
    }
    out.push({ filePath: full, fileName: name, createdAt, size })
  }
  // Sort descending by createdAt — newest first matches the "latest first"
  // expectation users have for "undo my last sync".
  out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  return out
}
