import { app } from 'electron'
import type { BackupFileMeta, BackupSnapshot } from '@shared/types'
import { ERROR_CODES } from '@shared/errors'
import { AppError } from '../errors'
import { decryptString, encryptString, type EncryptedBundle } from './crypto'

const MAGIC = 'AISTUDIO-BACKUP'
const SUPPORTED_SCHEMA = 1

interface BackupFile {
  magic: string
  schemaVersion: number
  appVersion: string
  createdAt: string
  encryption: {
    algo: 'AES-256-GCM'
    kdf: 'PBKDF2-SHA256'
    iterations: number
    salt: string
    iv: string
  }
  payload: string
  tag: string
}

/** Serialize a snapshot into the on-disk JSON form, encrypted with the user's password. */
export function encodeBackupFile(snapshot: BackupSnapshot, password: string): string {
  const bundle: EncryptedBundle = encryptString(JSON.stringify(snapshot), password)
  const file: BackupFile = {
    magic: MAGIC,
    schemaVersion: snapshot.schemaVersion,
    appVersion: snapshot.app.version,
    createdAt: snapshot.exportedAt,
    encryption: {
      algo: bundle.algo,
      kdf: bundle.kdf,
      iterations: bundle.iterations,
      salt: bundle.salt,
      iv: bundle.iv,
    },
    payload: bundle.payload,
    tag: bundle.tag,
  }
  return JSON.stringify(file, null, 2)
}

/** Read the plaintext header without decrypting the payload. */
export function peekBackupFile(rawJson: string): BackupFileMeta {
  const file = parseAndValidate(rawJson)
  return {
    schemaVersion: file.schemaVersion as 1,
    appVersion: file.appVersion,
    createdAt: file.createdAt,
  }
}

/** Decode + decrypt to a usable snapshot. */
export function decodeBackupFile(rawJson: string, password: string): BackupSnapshot {
  const file = parseAndValidate(rawJson)
  const bundle: EncryptedBundle = {
    payload: file.payload,
    tag: file.tag,
    salt: file.encryption.salt,
    iv: file.encryption.iv,
    algo: file.encryption.algo,
    kdf: file.encryption.kdf,
    iterations: file.encryption.iterations,
  }
  const json = decryptString(bundle, password)
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

function parseAndValidate(rawJson: string): BackupFile {
  let file: BackupFile
  try {
    file = JSON.parse(rawJson) as BackupFile
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
  if (!file.encryption || !file.payload || !file.tag) {
    throw new AppError(ERROR_CODES.BACKUP_FILE_INVALID, undefined, 'Missing fields')
  }
  return file
}
