import { randomUUID } from 'crypto'
import type { ModelDefinition, ModelCapability } from '@shared/types'
import { getDb } from './database'

interface ModelDefinitionRow {
  id: string
  name: string
  group_name: string
  capabilities: string
  context_window: number | null
  reasoning_efforts: string | null
  created_at: string
  updated_at: string
}

function rowToModelDefinition(row: ModelDefinitionRow): ModelDefinition {
  let capabilities: ModelCapability[] = []
  try {
    capabilities = JSON.parse(row.capabilities ?? '[]')
  } catch {
    capabilities = []
  }
  let reasoningEfforts: string[] | null = null
  if (row.reasoning_efforts) {
    try {
      const parsed = JSON.parse(row.reasoning_efforts)
      if (Array.isArray(parsed)) reasoningEfforts = parsed
    } catch {
      reasoningEfforts = null
    }
  }
  return {
    id: row.id,
    name: row.name,
    group: row.group_name,
    capabilities,
    contextWindow: row.context_window,
    reasoningEfforts,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function listModelDefinitions(): ModelDefinition[] {
  const rows = getDb()
    .prepare('SELECT * FROM model_definitions ORDER BY group_name ASC, name ASC')
    .all() as ModelDefinitionRow[]
  return rows.map(rowToModelDefinition)
}

export function countModelDefinitions(): number {
  const row = getDb().prepare('SELECT COUNT(*) AS n FROM model_definitions').get() as { n: number }
  return row.n
}

export function getModelDefinitionByName(name: string): ModelDefinition | undefined {
  const row = getDb().prepare('SELECT * FROM model_definitions WHERE name = ?').get(name) as
    | ModelDefinitionRow
    | undefined
  if (!row) return undefined
  return rowToModelDefinition(row)
}

export function getModelDefinition(id: string): ModelDefinition | undefined {
  const row = getDb().prepare('SELECT * FROM model_definitions WHERE id = ?').get(id) as
    | ModelDefinitionRow
    | undefined
  if (!row) return undefined
  return rowToModelDefinition(row)
}

export interface CreateModelDefinitionData {
  name: string
  group?: string
  capabilities?: ModelCapability[]
  contextWindow?: number | null
  reasoningEfforts?: string[] | null
}

export function createModelDefinition(data: CreateModelDefinitionData): ModelDefinition {
  const id = randomUUID()
  getDb()
    .prepare(
      `INSERT INTO model_definitions (id, name, group_name, capabilities, context_window, reasoning_efforts)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      data.name,
      data.group ?? '',
      JSON.stringify(data.capabilities ?? []),
      data.contextWindow ?? null,
      data.reasoningEfforts === undefined || data.reasoningEfforts === null
        ? null
        : JSON.stringify(data.reasoningEfforts),
    )
  return getModelDefinition(id)!
}

export interface UpdateModelDefinitionData {
  name?: string
  group?: string
  capabilities?: ModelCapability[]
  contextWindow?: number | null
  reasoningEfforts?: string[] | null
}

export function updateModelDefinition(
  id: string,
  data: UpdateModelDefinitionData,
): ModelDefinition | undefined {
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
  if (data.contextWindow !== undefined) {
    fields.push('context_window = ?')
    values.push(data.contextWindow)
  }
  if (data.reasoningEfforts !== undefined) {
    fields.push('reasoning_efforts = ?')
    values.push(data.reasoningEfforts === null ? null : JSON.stringify(data.reasoningEfforts))
  }

  if (fields.length === 0) return getModelDefinition(id)

  fields.push("updated_at = datetime('now')")
  values.push(id)
  // Safety: `fields` only contains hardcoded column assignments — no user input is interpolated
  getDb()
    .prepare(`UPDATE model_definitions SET ${fields.join(', ')} WHERE id = ?`)
    .run(...values)

  return getModelDefinition(id)
}

export function deleteModelDefinition(id: string): void {
  getDb().prepare('DELETE FROM model_definitions WHERE id = ?').run(id)
}

/**
 * Resolve a ModelDefinition for a given model name using three-level fallback:
 *   1. Exact match  (name = modelName)
 *   2. Prefix match (modelName starts with def.name + '-') → longest name wins
 *   3. Contains match (modelName includes def.name)        → longest name wins
 */
export function resolveModelDefinition(modelName: string): ModelDefinition | undefined {
  // Level 1: exact
  const exact = getModelDefinitionByName(modelName)
  if (exact) return exact

  const all = listModelDefinitions()

  // Level 2: prefix — modelName starts with def.name + '-'
  const prefixCandidates = all.filter((def) => modelName.startsWith(def.name + '-'))
  if (prefixCandidates.length > 0) {
    return prefixCandidates.reduce((best, cur) => (cur.name.length > best.name.length ? cur : best))
  }

  // Level 3: contains with word boundary — modelName includes def.name at a separator boundary
  const SEP = /[-_/.:]/
  const containsCandidates = all.filter((def) => {
    if (def.name.length < 2) return false
    const idx = modelName.indexOf(def.name)
    if (idx < 0) return false
    const before = idx === 0 || SEP.test(modelName[idx - 1])
    const afterIdx = idx + def.name.length
    const after = afterIdx >= modelName.length || SEP.test(modelName[afterIdx])
    return before && after
  })
  if (containsCandidates.length > 0) {
    return containsCandidates.reduce((best, cur) =>
      cur.name.length > best.name.length ? cur : best,
    )
  }

  return undefined
}
