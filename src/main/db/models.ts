import { randomUUID } from 'crypto'
import type { Model, ModelCapability } from '@shared/types'
import { getDb } from './database'
import { resolveModelDefinition } from './model-definitions'

interface ModelRow {
  id: string
  provider_id: string
  name: string
  group_name: string
  capabilities: string
  extra_params: string
  enabled: number
  sort_order: number
  created_at: string
}

function rowToModel(row: ModelRow): Model {
  let capabilities: ModelCapability[] = []
  try {
    capabilities = JSON.parse(row.capabilities)
  } catch {
    capabilities = []
  }
  let extraParams: Record<string, unknown> = {}
  try {
    const parsed = JSON.parse(row.extra_params)
    // Guard against `null` and arrays — the column must hold a plain object.
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      extraParams = parsed as Record<string, unknown>
    }
  } catch {
    extraParams = {}
  }
  return {
    id: row.id,
    providerId: row.provider_id,
    name: row.name,
    group: row.group_name,
    capabilities,
    extraParams,
    enabled: row.enabled === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  }
}

export function listModelsByProvider(providerId: string): Model[] {
  const rows = getDb()
    .prepare('SELECT * FROM models WHERE provider_id = ? ORDER BY sort_order ASC, created_at ASC')
    .all(providerId) as ModelRow[]
  return rows.map(rowToModel)
}

export function listAllModels(): Model[] {
  const rows = getDb()
    .prepare('SELECT * FROM models ORDER BY provider_id, sort_order ASC, created_at ASC')
    .all() as ModelRow[]
  return rows.map(rowToModel)
}

export function getModel(id: string): Model | undefined {
  const row = getDb().prepare('SELECT * FROM models WHERE id = ?').get(id) as ModelRow | undefined
  if (!row) return undefined
  return rowToModel(row)
}

/**
 * Look up a model by provider + model name. The chat path only has the model
 * name (assistants store the name, not the row id). `(provider_id, name)` has
 * no unique constraint, so mirror `listModelsByProvider`'s ordering and take
 * the first row.
 */
export function getModelByName(providerId: string, name: string): Model | undefined {
  const row = getDb()
    .prepare(
      `SELECT * FROM models WHERE provider_id = ? AND name = ?
       ORDER BY sort_order ASC, created_at ASC LIMIT 1`,
    )
    .get(providerId, name) as ModelRow | undefined
  if (!row) return undefined
  return rowToModel(row)
}

export interface CreateModelData {
  providerId: string
  name: string
  group?: string
  capabilities?: ModelCapability[]
  extraParams?: Record<string, unknown>
  enabled?: boolean
  sortOrder?: number
}

export function createModel(data: CreateModelData): Model {
  const id = randomUUID()

  // Auto-fill from global model definitions if capabilities not provided
  let capabilities = data.capabilities ?? []
  let group = data.group ?? ''
  if (capabilities.length === 0) {
    const def = resolveModelDefinition(data.name)
    if (def) {
      capabilities = def.capabilities
      if (!group) group = def.group
    }
  }

  getDb()
    .prepare(
      `INSERT INTO models (id, provider_id, name, group_name, capabilities, extra_params, enabled, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      data.providerId,
      data.name,
      group,
      JSON.stringify(capabilities),
      JSON.stringify(data.extraParams ?? {}),
      data.enabled !== false ? 1 : 0,
      data.sortOrder ?? 0,
    )
  return getModel(id)!
}

export interface UpdateModelData {
  name?: string
  group?: string
  capabilities?: ModelCapability[]
  extraParams?: Record<string, unknown>
  enabled?: boolean
  sortOrder?: number
}

export function updateModel(id: string, data: UpdateModelData): Model | undefined {
  const fields: string[] = []
  const values: unknown[] = []

  if (data.name !== undefined) {
    fields.push('name = ?')
    values.push(data.name)
  }
  if (data.group !== undefined) {
    fields.push('group_name = ?')
    values.push(data.group)
  }
  if (data.capabilities !== undefined) {
    fields.push('capabilities = ?')
    values.push(JSON.stringify(data.capabilities))
  }
  if (data.extraParams !== undefined) {
    fields.push('extra_params = ?')
    values.push(JSON.stringify(data.extraParams))
  }
  if (data.enabled !== undefined) {
    fields.push('enabled = ?')
    values.push(data.enabled ? 1 : 0)
  }
  if (data.sortOrder !== undefined) {
    fields.push('sort_order = ?')
    values.push(data.sortOrder)
  }

  if (fields.length === 0) return getModel(id)

  values.push(id)
  getDb()
    .prepare(`UPDATE models SET ${fields.join(', ')} WHERE id = ?`)
    .run(...values)

  return getModel(id)
}

export function deleteModel(id: string): void {
  getDb().prepare('DELETE FROM models WHERE id = ?').run(id)
}

export function deleteModelsByProvider(providerId: string): void {
  getDb().prepare('DELETE FROM models WHERE provider_id = ?').run(providerId)
}

export function reorderModels(ids: string[]): void {
  const db = getDb()
  const update = db.prepare('UPDATE models SET sort_order = ? WHERE id = ?')
  db.transaction(() => {
    ids.forEach((id, index) => update.run(index, id))
  })()
}
