import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'crypto'
import { ERROR_CODES } from '@shared/errors'
import { AppError } from '../errors'

const KDF_ITERATIONS = 200_000
const KDF_KEYLEN = 32 // 256-bit key for AES-256-GCM
const KDF_DIGEST = 'sha256'
const SALT_LEN = 16
const IV_LEN = 12
const TAG_LEN = 16

export interface EncryptedBundle {
  /** Base64-encoded ciphertext. */
  payload: string
  /** Base64-encoded GCM auth tag (16 bytes). */
  tag: string
  /** Base64-encoded PBKDF2 salt (16 bytes). */
  salt: string
  /** Base64-encoded GCM IV / nonce (12 bytes). */
  iv: string
  algo: 'AES-256-GCM'
  kdf: 'PBKDF2-SHA256'
  iterations: number
}

/** Derive a 32-byte key from the user's password. */
function deriveKey(password: string, salt: Buffer, iterations: number): Buffer {
  return pbkdf2Sync(password, salt, iterations, KDF_KEYLEN, KDF_DIGEST)
}

/** Encrypt a UTF-8 string with the given password. Generates fresh salt + IV per call. */
export function encryptString(plaintext: string, password: string): EncryptedBundle {
  const salt = randomBytes(SALT_LEN)
  const iv = randomBytes(IV_LEN)
  const key = deriveKey(password, salt, KDF_ITERATIONS)

  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return {
    payload: enc.toString('base64'),
    tag: tag.toString('base64'),
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    algo: 'AES-256-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations: KDF_ITERATIONS,
  }
}

/** Decrypt a bundle. Throws `AppError(BACKUP_PASSWORD_WRONG)` on auth-tag failure. */
export function decryptString(bundle: EncryptedBundle, password: string): string {
  if (bundle.algo !== 'AES-256-GCM' || bundle.kdf !== 'PBKDF2-SHA256') {
    throw new AppError(ERROR_CODES.BACKUP_FILE_INVALID, undefined, 'Unsupported encryption header')
  }
  const salt = Buffer.from(bundle.salt, 'base64')
  const iv = Buffer.from(bundle.iv, 'base64')
  const tag = Buffer.from(bundle.tag, 'base64')
  const enc = Buffer.from(bundle.payload, 'base64')
  if (salt.length !== SALT_LEN || iv.length !== IV_LEN || tag.length !== TAG_LEN) {
    throw new AppError(
      ERROR_CODES.BACKUP_FILE_INVALID,
      undefined,
      'Encryption header has bad lengths',
    )
  }
  const key = deriveKey(password, salt, bundle.iterations)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  try {
    const dec = Buffer.concat([decipher.update(enc), decipher.final()])
    return dec.toString('utf8')
  } catch {
    // Wrong password OR tampered ciphertext both land here — surface a single error.
    throw new AppError(ERROR_CODES.BACKUP_PASSWORD_WRONG)
  }
}
