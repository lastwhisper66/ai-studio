import { dialog, BrowserWindow } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import type { BackupFileMeta, BackupImportMode, BackupProgress, BackupSummary } from '@shared/types'
import { ERROR_CODES } from '@shared/errors'
import { AppError } from '../errors'
import { IpcChannels } from '@shared/ipc-channels'
import { decodeBackupFile, encodeBackupFile, peekBackupFile } from './codec'
import { applySnapshot, collectSnapshot } from './snapshot'

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
