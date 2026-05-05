import { app } from 'electron'
import type { BackupFileMeta, BackupSnapshot } from '@shared/types'
import { ERROR_CODES } from '@shared/errors'
import { AppError } from '../errors'

const MAGIC = 'AISTUDIO-BACKUP'
const SUPPORTED_SCHEMA = 1

interface PlaintextBackupFile {
  magic: string
  schemaVersion: number
  appVersion: string
  createdAt: string
  encryption: { algo: 'none' }
  payload: string
}

/**
 * Serialize a snapshot as a plaintext backup file. The payload is base64-
 * encoded JSON — readable to anyone who can read the file. Storage location
 * is assumed trusted (local filesystem chosen by the user, or cloud remote
 * the user configured themselves).
 */
export function encodeBackupFile(snapshot: BackupSnapshot): string {
  const json = JSON.stringify(snapshot)
  const file: PlaintextBackupFile = {
    magic: MAGIC,
    schemaVersion: snapshot.schemaVersion,
    appVersion: snapshot.app.version,
    createdAt: snapshot.exportedAt,
    encryption: { algo: 'none' },
    payload: Buffer.from(json, 'utf8').toString('base64'),
  }
  return JSON.stringify(file, null, 2)
}

/** Read the plaintext header. */
export function peekBackupFile(rawJson: string): BackupFileMeta {
  const file = parseAndValidate(rawJson)
  return {
    schemaVersion: file.schemaVersion as 1,
    appVersion: file.appVersion,
    createdAt: file.createdAt,
  }
}

/**
 * Decode a plaintext backup file. Any file with `encryption.algo !== 'none'`
 * is rejected as `BACKUP_FILE_INVALID` — legacy encrypted backups are no
 * longer supported (program was unreleased; hard cut per design spec).
 */
export function decodeBackupFile(rawJson: string): BackupSnapshot {
  const file = parseAndValidate(rawJson)
  const json = Buffer.from(file.payload, 'base64').toString('utf8')

  let snapshot: BackupSnapshot
  try {
    snapshot = JSON.parse(json) as BackupSnapshot
  } catch {
    throw new AppError(ERROR_CODES.BACKUP_FILE_INVALID, undefined, 'Snapshot JSON parse failed')
  }
  if (snapshot.schemaVersion !== SUPPORTED_SCHEMA) {
    throw new AppError(ERROR_CODES.BACKUP_SCHEMA_TOO_NEW)
  }
  return snapshot
}

/** Build the snapshot's plaintext envelope. */
export function buildSnapshotEnvelope<
  T extends Omit<BackupSnapshot, 'schemaVersion' | 'exportedAt' | 'app'>,
>(data: T): BackupSnapshot {
  return {
    schemaVersion: SUPPORTED_SCHEMA,
    exportedAt: new Date().toISOString(),
    app: { version: app.getVersion() },
    ...data,
  } as BackupSnapshot
}

function parseAndValidate(rawJson: string): PlaintextBackupFile {
  let file: PlaintextBackupFile
  try {
    file = JSON.parse(rawJson) as PlaintextBackupFile
  } catch {
    throw new AppError(ERROR_CODES.BACKUP_FILE_INVALID, undefined, 'Outer JSON parse failed')
  }
  if (file.magic !== MAGIC) {
    throw new AppError(ERROR_CODES.BACKUP_FILE_INVALID, undefined, 'Bad magic')
  }
  if (typeof file.schemaVersion !== 'number') {
    throw new AppError(ERROR_CODES.BACKUP_FILE_INVALID, undefined, 'Missing schemaVersion')
  }
  if (file.schemaVersion > SUPPORTED_SCHEMA) {
    throw new AppError(ERROR_CODES.BACKUP_SCHEMA_TOO_NEW)
  }
  if (!file.encryption || !file.payload) {
    throw new AppError(ERROR_CODES.BACKUP_FILE_INVALID, undefined, 'Missing fields')
  }
  if (file.encryption.algo !== 'none') {
    throw new AppError(
      ERROR_CODES.BACKUP_FILE_INVALID,
      undefined,
      'Encrypted backups are no longer supported',
    )
  }
  return file
}
