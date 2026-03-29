import { randomUUID } from 'crypto'
import type { Model, ModelCapability } from '@shared/types'
import { getDb } from './database'
import { getModelDefinitionByName } from './model-definitions'

interface ModelRow {
  id: string
  provider_id: string
  name: string
  group_name: string
  capabilities: string
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
  return {
    id: row.id,
    providerId: row.provider_id,
    name: row.name,
    group: row.group_name,
    capabilities,
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

export interface CreateModelData {
  providerId: string
  name: string
  group?: string
  capabilities?: ModelCapability[]
  enabled?: boolean
  sortOrder?: number
}

export function createModel(data: CreateModelData): Model {
  const id = randomUUID()

  // Auto-fill from global model definitions if capabilities not provided
  let capabilities = data.capabilities ?? []
  let group = data.group ?? ''
  if (capabilities.length === 0) {
    const def = getModelDefinitionByName(data.name)
    if (def) {
      capabilities = def.capabilities
      if (!group) group = def.group
    }
  }

  getDb()
    .prepare(
      `INSERT INTO models (id, provider_id, name, group_name, capabilities, enabled, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      data.providerId,
      data.name,
      group,
      JSON.stringify(capabilities),
      data.enabled !== false ? 1 : 0,
      data.sortOrder ?? 0,
    )
  return getModel(id)!
}

export interface UpdateModelData {
  name?: string
  group?: string
  capabilities?: ModelCapability[]
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
