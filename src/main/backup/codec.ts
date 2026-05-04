import { app } from 'electron'
import type { BackupFileMeta, BackupSnapshot } from '@shared/types'
import { ERROR_CODES } from '@shared/errors'
import { AppError } from '../errors'
import {
  decryptString,
  encryptString,
  KDF_ALGO,
  KDF_ITERATIONS,
  KDF_NAME,
  type EncryptedBundle,
} from './crypto'

const MAGIC = 'AISTUDIO-BACKUP'
const SUPPORTED_SCHEMA = 1

interface EncryptedBackupFile {
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

interface PlaintextBackupFile {
  magic: string
  schemaVersion: number
  appVersion: string
  createdAt: string
  encryption: { algo: 'none' }
  payload: string
}

type BackupFile = EncryptedBackupFile | PlaintextBackupFile

/**
 * Build the AAD (additional authenticated data) bound into the GCM tag.
 * Any modification to magic / schemaVersion / algo / kdf / iterations on
 * disk will invalidate the tag and cause decryption to fail. We deliberately
 * exclude `appVersion` and `createdAt` from the AAD so re-stamping metadata
 * (e.g. for diagnostics) wouldn't break decryption — those fields aren't
 * security-relevant.
 */
function buildAad(
  magic: string,
  schemaVersion: number,
  algo: string,
  kdf: string,
  iterations: number,
): Buffer {
  return Buffer.from(`${magic}|${schemaVersion}|${algo}|${kdf}|${iterations}`, 'utf8')
}

/**
 * Serialize a snapshot. `password === null` (or empty string) → plaintext mode
 * (`encryption.algo: 'none'`); otherwise AES-256-GCM with PBKDF2.
 *
 * Plaintext is base64-encoded JSON — readable to anyone who can read the
 * file. Use only when the storage location is trusted.
 */
export function encodeBackupFile(snapshot: BackupSnapshot, password: string | null): string {
  const json = JSON.stringify(snapshot)

  if (!password) {
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

  const aad = buildAad(MAGIC, SUPPORTED_SCHEMA, KDF_ALGO, KDF_NAME, KDF_ITERATIONS)
  const bundle: EncryptedBundle = encryptString(json, password, aad)
  const file: EncryptedBackupFile = {
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
    encrypted: file.encryption.algo !== 'none',
  }
}

/**
 * Decode a backup file. `password` is required for encrypted files; for
 * plaintext files (`encryption.algo === 'none'`) it's ignored. Pass `null`
 * for plaintext files when known via `peekBackupFile` first.
 */
export function decodeBackupFile(rawJson: string, password: string | null): BackupSnapshot {
  const file = parseAndValidate(rawJson)
  let json: string
  if (file.encryption.algo === 'none') {
    json = Buffer.from(file.payload, 'base64').toString('utf8')
  } else {
    if (!password) {
      // Encrypted file but no password supplied — surface as wrong password.
      throw new AppError(ERROR_CODES.BACKUP_PASSWORD_WRONG)
    }
    // TS narrows `file.encryption.algo` to 'AES-256-GCM' here but doesn't
    // propagate that to `file` itself, so `file.tag` would error on the
    // PlaintextBackupFile branch of the union. parseAndValidate already
    // verified the tag exists on encrypted files.
    const enc = file as EncryptedBackupFile
    const aad = buildAad(
      enc.magic,
      enc.schemaVersion,
      enc.encryption.algo,
      enc.encryption.kdf,
      enc.encryption.iterations,
    )
    const bundle: EncryptedBundle = {
      payload: enc.payload,
      tag: enc.tag,
      salt: enc.encryption.salt,
      iv: enc.encryption.iv,
      algo: enc.encryption.algo,
      kdf: enc.encryption.kdf,
      iterations: enc.encryption.iterations,
    }
    json = decryptString(bundle, password, aad)
  }

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
  if (!file.encryption || !file.payload) {
    throw new AppError(ERROR_CODES.BACKUP_FILE_INVALID, undefined, 'Missing fields')
  }
  // Encrypted files MUST have a tag; plaintext files MUST NOT (sanity check).
  if (file.encryption.algo === 'AES-256-GCM') {
    if (!('tag' in file) || !file.tag) {
      throw new AppError(ERROR_CODES.BACKUP_FILE_INVALID, undefined, 'Missing GCM tag')
    }
  } else if (file.encryption.algo === 'none') {
    // OK — plaintext mode.
  } else {
    throw new AppError(ERROR_CODES.BACKUP_FILE_INVALID, undefined, 'Unsupported encryption algo')
  }
  return file
}
