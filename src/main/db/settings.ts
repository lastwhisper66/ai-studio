import { safeStorage } from 'electron'
import { getDb } from './database'

const SENSITIVE_KEYS = new Set([
  'api.apiKey',
  'backup.remote.password',
  'backup.remote.secretAccessKey',
  'backup.syncPassphrase',
])

export function encrypt(value: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(value)
    return 'enc:' + encrypted.toString('base64')
  }
  return value
}

export function decrypt(value: string): string {
  if (value.startsWith('enc:') && safeStorage.isEncryptionAvailable()) {
    const buffer = Buffer.from(value.slice(4), 'base64')
    return safeStorage.decryptString(buffer)
  }
  return value
}

export function getSetting(key: string): string | undefined {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  if (!row) return undefined
  return SENSITIVE_KEYS.has(key) ? decrypt(row.value) : row.value
}

export function setSetting(key: string, value: string): void {
  const stored = SENSITIVE_KEYS.has(key) ? encrypt(value) : value
  getDb()
    .prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(key, stored)
}

export function setSettingsBatch(entries: Record<string, string>): void {
  const db = getDb()
  const stmt = db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  )
  db.transaction(() => {
    for (const [key, value] of Object.entries(entries)) {
      const stored = SENSITIVE_KEYS.has(key) ? encrypt(value) : value
      stmt.run(key, stored)
    }
  })()
}

export function getAllSettings(): Record<string, string> {
  const rows = getDb().prepare('SELECT key, value FROM settings').all() as {
    key: string
    value: string
  }[]

  const result: Record<string, string> = {}
  for (const row of rows) {
    result[row.key] = SENSITIVE_KEYS.has(row.key) ? decrypt(row.value) : row.value
  }
  return result
}
