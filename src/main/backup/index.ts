import { dialog, BrowserWindow } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs'
import { join } from 'path'
import type {
  BackupFileMeta,
  BackupImportMode,
  BackupProgress,
  BackupSummary,
  RemoteConfig,
  RemoteConfigs,
  RemoteType,
  RollbackBackupItem,
  S3RemoteConfig,
  WebDavRemoteConfig,
} from '@shared/types'
import { ERROR_CODES } from '@shared/errors'
import { AppError } from '../errors'
import { IpcChannels } from '@shared/ipc-channels'
import { t } from '../i18n'
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

/** Show a save dialog, then write the backup file as plaintext. */
export async function exportToFile(): Promise<ExportResult> {
  broadcast({ type: 'local', phase: 'collect' })
  const snapshot = collectSnapshot()
  broadcast({ type: 'local', phase: 'encrypt' })
  const json = encodeBackupFile(snapshot)

  const defaultName = `aistudio-backup-${snapshot.exportedAt.replace(/[:.]/g, '-')}.aibackup`
  const result = await dialog.showSaveDialog({
    title: t('settings.backup.dialog.exportTitle'),
    defaultPath: defaultName,
    filters: [{ name: t('settings.backup.dialog.fileFilter'), extensions: ['aibackup'] }],
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

/** Decode + apply a plaintext backup file to the local DB. */
export async function importFromFile(
  filePath: string,
  mode: BackupImportMode,
): Promise<BackupSummary> {
  broadcast({ type: 'local', phase: 'decrypt' })
  const raw = await readFile(filePath, 'utf8')
  const snapshot = decodeBackupFile(raw)
  // Stash the current local state BEFORE applying so "Undo last import" works.
  // Best-effort: a failure here must not block the import. Skipped in `merge`
  // mode because the operation is non-destructive — local-only rows survive.
  if (mode === 'replace') {
    try {
      writePreApplyRollback()
    } catch {
      /* best-effort — proceed with import even if the safety net failed */
    }
  }
  broadcast({ type: 'local', phase: 'apply' })
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

/** Helper for the cloud sync flow — produce backup bytes without touching disk. */
export function encodeSnapshotBytes(): {
  bytes: Uint8Array
  createdAt: string
} {
  const snapshot = collectSnapshot()
  const json = encodeBackupFile(snapshot)
  return { bytes: new TextEncoder().encode(json), createdAt: snapshot.exportedAt }
}

/** Helper for the cloud sync flow — apply a snapshot from in-memory bytes. */
export function applyBackupBytes(bytes: Uint8Array, mode: BackupImportMode): BackupSummary {
  const json = new TextDecoder().decode(bytes)
  const snapshot = decodeBackupFile(json)
  return applySnapshot(snapshot, mode)
}

// Re-exports so tests / future code can reach internals through one entry.
export { collectSnapshot, applySnapshot } from './snapshot'
export { peekBackupFile } from './codec'

// ---------------------------------------------------------------------------
// Remote-config persistence + factory (multi-remote: webdav + s3 simultaneously)
// ---------------------------------------------------------------------------
//
// Storage layout:
//   backup.remote.webdav.enabled       '1' | '0'
//   backup.remote.webdav.config        JSON {url, username, subPath}
//   backup.remote.webdav.password      encrypted (safeStorage)
//   backup.remote.s3.enabled           '1' | '0'
//   backup.remote.s3.config            JSON {endpoint, region, bucket, accessKeyId, forcePathStyle, prefix}
//   backup.remote.s3.secretAccessKey   encrypted (safeStorage)
//
// Either or both may be set. The sync-service uploads to every enabled
// remote and reads manifests from each, picking the freshest as the source
// of truth for download.
// ---------------------------------------------------------------------------

function loadWebDavConfig(): WebDavRemoteConfig | null {
  // "Configured" is determined by whether credentials are saved — independent
  // of the user's per-remote `enabled` switch (which `loadEnabledRemotes`
  // applies on top).
  const cfgRaw = getSetting('backup.remote.webdav.config')
  if (!cfgRaw) return null
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(cfgRaw)
  } catch {
    return null
  }
  return {
    type: 'webdav',
    url: String(parsed.url ?? ''),
    username: String(parsed.username ?? ''),
    password: getSetting('backup.remote.webdav.password') ?? '',
    subPath: String(parsed.subPath ?? ''),
  }
}

function loadS3Config(): S3RemoteConfig | null {
  const cfgRaw = getSetting('backup.remote.s3.config')
  if (!cfgRaw) return null
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(cfgRaw)
  } catch {
    return null
  }
  return {
    type: 's3',
    endpoint: String(parsed.endpoint ?? ''),
    region: String(parsed.region ?? 'auto'),
    bucket: String(parsed.bucket ?? ''),
    accessKeyId: String(parsed.accessKeyId ?? ''),
    secretAccessKey: getSetting('backup.remote.s3.secretAccessKey') ?? '',
    forcePathStyle: parsed.forcePathStyle === true,
    prefix: String(parsed.prefix ?? ''),
  }
}

/** Load both remote configs (independent of enabled-state). Either field can be null when not configured. */
export function loadRemoteConfigs(): RemoteConfigs {
  return { webdav: loadWebDavConfig(), s3: loadS3Config() }
}

/** Single-type lookup. Returns the configured remote regardless of enabled state. */
export function loadRemoteConfig(type: RemoteType): RemoteConfig | null {
  if (type === 'webdav') return loadWebDavConfig()
  return loadS3Config()
}

/**
 * Returns just the configured AND enabled remotes, in canonical order.
 *
 * "Enabled" is the per-remote user switch persisted at
 * `backup.remote.{type}.enabled`. We treat anything other than the literal
 * `'false'` as enabled — including the legacy `'1'` value still found on
 * upgrade paths and the post-migration `'true'`. Missing key also defaults
 * to enabled, which preserves prior behavior where any saved config was
 * actively syncing.
 */
export function loadEnabledRemotes(): RemoteConfig[] {
  const out: RemoteConfig[] = []
  const wd = loadWebDavConfig()
  if (wd && getSetting('backup.remote.webdav.enabled') !== 'false') out.push(wd)
  const s3 = loadS3Config()
  if (s3 && getSetting('backup.remote.s3.enabled') !== 'false') out.push(s3)
  return out
}

/** Single-type variant of `loadEnabledRemotes`. */
export function loadEnabledRemote(type: RemoteType): RemoteConfig | null {
  return loadEnabledRemotes().find((c) => c.type === type) ?? null
}

/** Persist a single remote (and mark it enabled). The other remote is untouched. */
export function saveRemoteConfig(cfg: RemoteConfig): void {
  if (cfg.type === 'webdav') {
    setSetting('backup.remote.webdav.enabled', 'true')
    setSetting(
      'backup.remote.webdav.config',
      JSON.stringify({ url: cfg.url, username: cfg.username, subPath: cfg.subPath }),
    )
    setSetting('backup.remote.webdav.password', cfg.password)
  } else {
    setSetting('backup.remote.s3.enabled', 'true')
    setSetting(
      'backup.remote.s3.config',
      JSON.stringify({
        endpoint: cfg.endpoint,
        region: cfg.region,
        bucket: cfg.bucket,
        accessKeyId: cfg.accessKeyId,
        forcePathStyle: cfg.forcePathStyle,
        prefix: cfg.prefix,
      }),
    )
    setSetting('backup.remote.s3.secretAccessKey', cfg.secretAccessKey)
  }
}

/** Remove all rows for a single remote. The other remote is untouched. */
export function clearRemoteConfig(type: RemoteType): void {
  const db = getDb()
  const prefix = `backup.remote.${type}.`
  db.prepare(`DELETE FROM settings WHERE key LIKE ?`).run(`${prefix}%`)
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

/**
 * Probe the remote with a tiny PUT/GET/DELETE round-trip. The probe object
 * lives under a `_probe/` prefix so retention pruning (which scans
 * `backups/`) can never sweep it, and so a stray probe never confuses a
 * snapshot listing.
 */
export async function testRemote(cfg: RemoteConfig): Promise<{ ok: boolean; latency: number }> {
  const remote = buildRemote(cfg)
  const probeKey = `_probe/aistudio-probe-${Date.now()}.txt`
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

const ROLLBACK_DIR_NAME = 'auto-rollback'
const ROLLBACK_FILENAME_RE = /^pre-apply-(.+)\.aibackup$/
const SAFE_ISO_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/

function rollbackDir(): string {
  return join(getDataDir(), 'backups', ROLLBACK_DIR_NAME)
}

/**
 * Write the CURRENT local state as a plaintext pre-apply rollback copy. Used
 * by both local file import and cloud restore so the user can undo a
 * destructive apply by importing the rollback file later.
 *
 * `triggeredBy` records which event produced the rollback so the UI can show
 * "Triggered by WebDAV" / "Triggered by S3" / "Manual" in the rollback list.
 *
 * Returns the absolute path to the file just written. Pruning runs after
 * writing and is taught to skip the file we just produced.
 */
export function writePreApplyRollback(triggeredBy: RemoteType | 'manual' = 'manual'): string {
  const dir = rollbackDir()
  mkdirSync(dir, { recursive: true })
  const { bytes } = encodeSnapshotBytes()
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const path = join(dir, `pre-apply-${stamp}.aibackup`)
  writeFileSync(path, Buffer.from(bytes))
  // Sidecar JSON records `triggeredBy` so the rollback dialog can show
  // "Triggered by WebDAV / S3 / Manual". Best-effort: a write failure here
  // (e.g. disk full) just leaves the entry tagged 'manual' on read.
  try {
    writeFileSync(`${path}.meta.json`, JSON.stringify({ triggeredBy }), 'utf8')
  } catch {
    /* tolerate */
  }
  pruneRollbackCopies(path)
  return path
}

/**
 * Keep at most `backup.maxRetainedBackups` rollback files (default 5),
 * deleting oldest first. Filenames embed an ISO timestamp so lex-descending
 * sort = newest-first. The just-written `keepPath` is never pruned even if
 * clock skew or filename collision would otherwise place it outside the
 * retention window.
 */
function pruneRollbackCopies(keepPath?: string): void {
  const dir = rollbackDir()
  // The rollback retention budget covers BOTH remotes' triggers + manual
  // applies (rollbacks aren't tagged per-remote on disk for retention purposes).
  // Use the larger of the two per-remote retention values so a user who set
  // one remote to "keep 20" doesn't lose rollbacks from the other remote.
  const wd = parseInt(getSetting('backup.remote.webdav.maxRetainedBackups') ?? '5', 10)
  const s3 = parseInt(getSetting('backup.remote.s3.maxRetainedBackups') ?? '5', 10)
  const max = Math.max(wd, s3, 1)
  if (max <= 0) return
  if (!existsSync(dir)) return
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.aibackup'))
    .map((name) => ({ name, full: join(dir, name) }))
    .sort((a, b) => (a.name < b.name ? 1 : -1))
  for (const f of files.slice(max)) {
    if (keepPath && f.full === keepPath) continue
    try {
      rmSync(f.full, { force: true })
      // Best-effort cleanup of the sidecar metadata file alongside the
      // rollback. If only the sidecar is missing the rollback is still
      // restorable; if only the rollback is gone the sidecar is harmless.
      rmSync(`${f.full}.meta.json`, { force: true })
    } catch {
      /* best-effort — a leftover file just delays the next prune by one
         cycle and is otherwise harmless. */
    }
  }
}

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
 * Read the rollback's sidecar JSON to recover its `triggeredBy` tag. Older
 * rollbacks (predating the sidecar) and any case where the sidecar can't be
 * read or parsed fall back to `'manual'` — purely informational, never blocks
 * a restore.
 */
function readTriggeredBySidecar(rollbackPath: string): RemoteType | 'manual' {
  const sidecar = `${rollbackPath}.meta.json`
  if (!existsSync(sidecar)) return 'manual'
  try {
    const meta = JSON.parse(readFileSync(sidecar, 'utf8')) as { triggeredBy?: unknown }
    if (
      meta.triggeredBy === 'webdav' ||
      meta.triggeredBy === 's3' ||
      meta.triggeredBy === 'manual'
    ) {
      return meta.triggeredBy
    }
  } catch {
    /* fall through */
  }
  return 'manual'
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
  const dir = rollbackDir()
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
    out.push({
      filePath: full,
      fileName: name,
      createdAt,
      size,
      triggeredBy: readTriggeredBySidecar(full),
    })
  }
  // Sort descending by createdAt — newest first matches the "latest first"
  // expectation users have for "undo my last sync".
  out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  return out
}
