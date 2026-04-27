import { randomUUID } from 'crypto'
import type { Provider, ProviderType } from '@shared/types'
import { getDb } from './database'
import { createModel } from './models'
import { DEFAULT_MODELS_BY_PROVIDER_TYPE, DEFAULT_PROVIDER_SEEDS } from './seeds/providers'
import { encrypt, decrypt } from './settings'

interface ProviderRow {
  id: string
  type: string
  name: string
  api_key: string
  base_url: string
  enabled: number
  is_default: number
  sort_order: number
  created_at: string
  updated_at: string
}

function rowToProvider(row: ProviderRow): Provider {
  return {
    id: row.id,
    type: row.type as ProviderType,
    name: row.name,
    apiKey: row.api_key ? decrypt(row.api_key) : '',
    baseUrl: row.base_url,
    enabled: row.enabled === 1,
    isDefault: row.is_default === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function listProviders(): Provider[] {
  const rows = getDb()
    .prepare('SELECT * FROM providers ORDER BY sort_order ASC, created_at ASC')
    .all() as ProviderRow[]
  return rows.map(rowToProvider)
}

export function getProvider(id: string): Provider | undefined {
  const row = getDb().prepare('SELECT * FROM providers WHERE id = ?').get(id) as
    | ProviderRow
    | undefined
  if (!row) return undefined
  return rowToProvider(row)
}

export interface CreateProviderData {
  type: ProviderType
  name: string
  apiKey?: string
  baseUrl?: string
  enabled?: boolean
  isDefault?: boolean
  sortOrder?: number
}

export function createProvider(data: CreateProviderData): Provider {
  const id = randomUUID()
  const apiKey = data.apiKey ? encrypt(data.apiKey) : ''
  getDb()
    .prepare(
      `INSERT INTO providers (id, type, name, api_key, base_url, enabled, is_default, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      data.type,
      data.name,
      apiKey,
      data.baseUrl ?? '',
      data.enabled !== false ? 1 : 0,
      data.isDefault ? 1 : 0,
      data.sortOrder ?? 0,
    )

  for (const [index, name] of (DEFAULT_MODELS_BY_PROVIDER_TYPE[data.type] ?? []).entries()) {
    createModel({
      providerId: id,
      name,
      sortOrder: index,
    })
  }

  return getProvider(id)!
}

export interface UpdateProviderData {
  name?: string
  apiKey?: string
  baseUrl?: string
  enabled?: boolean
  sortOrder?: number
}

export function updateProvider(id: string, data: UpdateProviderData): Provider | undefined {
  const fields: string[] = []
  const values: unknown[] = []

  if (data.name !== undefined) {
    fields.push('name = ?')
    values.push(data.name)
  }
  if (data.apiKey !== undefined) {
    fields.push('api_key = ?')
    values.push(data.apiKey ? encrypt(data.apiKey) : '')
  }
  if (data.baseUrl !== undefined) {
    fields.push('base_url = ?')
    values.push(data.baseUrl)
  }
  if (data.enabled !== undefined) {
    fields.push('enabled = ?')
    values.push(data.enabled ? 1 : 0)
  }
  if (data.sortOrder !== undefined) {
    fields.push('sort_order = ?')
    values.push(data.sortOrder)
  }

  if (fields.length === 0) return getProvider(id)

  fields.push("updated_at = datetime('now')")
  values.push(id)

  getDb()
    .prepare(`UPDATE providers SET ${fields.join(', ')} WHERE id = ?`)
    .run(...values)

  return getProvider(id)
}

export function deleteProvider(id: string): void {
  getDb().prepare('DELETE FROM providers WHERE id = ?').run(id)
}

export function reorderProviders(ids: string[]): void {
  const db = getDb()
  const update = db.prepare('UPDATE providers SET sort_order = ? WHERE id = ?')
  db.transaction(() => {
    ids.forEach((id, index) => update.run(index, id))
  })()
}

/** Seed default providers on first launch (when providers table is empty) */
export function seedDefaultProviders(): void {
  const count = getDb().prepare('SELECT COUNT(*) as cnt FROM providers').get() as { cnt: number }
  if (count.cnt > 0) return

  for (const [index, seed] of DEFAULT_PROVIDER_SEEDS.entries()) {
    createProvider({ ...seed, sortOrder: index, isDefault: true })
  }
}
