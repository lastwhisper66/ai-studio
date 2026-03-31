import { randomUUID } from 'crypto'
import type { ModelDefinition, ModelCapability, ProviderType } from '@shared/types'
import { getDb } from './database'

interface ModelDefinitionRow {
  id: string
  name: string
  group_name: string
  capabilities: string
  provider_types: string
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
  let providerTypes: ProviderType[] = []
  try {
    providerTypes = JSON.parse(row.provider_types ?? '[]')
  } catch {
    providerTypes = []
  }
  return {
    id: row.id,
    name: row.name,
    group: row.group_name,
    capabilities,
    providerTypes,
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
  providerTypes?: ProviderType[]
}

export function createModelDefinition(data: CreateModelDefinitionData): ModelDefinition {
  const id = randomUUID()
  getDb()
    .prepare(
      `INSERT INTO model_definitions (id, name, group_name, capabilities, provider_types)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      data.name,
      data.group ?? '',
      JSON.stringify(data.capabilities ?? []),
      JSON.stringify(data.providerTypes ?? []),
    )
  return getModelDefinition(id)!
}

export interface UpdateModelDefinitionData {
  name?: string
  group?: string
  capabilities?: ModelCapability[]
  providerTypes?: ProviderType[]
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
  if (data.providerTypes !== undefined) {
    fields.push('provider_types = ?')
    values.push(JSON.stringify(data.providerTypes))
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

/**
 * Seed the model_definitions table with built-in catalog data.
 * Uses a version number stored in the settings table so that new models
 * added in future app releases are merged in without overwriting user edits.
 * INSERT OR IGNORE ensures existing (user-modified) rows are never touched.
 */

const SEED_VERSION = 2

interface SeedEntry {
  name: string
  group: string
  capabilities: ModelCapability[]
  providerTypes: ProviderType[]
}

// Seed data lives in a standalone JSON file for easier maintenance
import seedData from './seed-model-definitions.json'
const SEED_DATA: SeedEntry[] = seedData as SeedEntry[]

export function seedModelDefinitions(): void {
  const db = getDb()

  const row = db
    .prepare("SELECT value FROM settings WHERE key = 'model_definitions_seed_version'")
    .get() as { value: string } | undefined
  const currentVersion = row ? Number(row.value) : 0
  if (currentVersion >= SEED_VERSION) return

  const insert = db.prepare(
    `INSERT INTO model_definitions (id, name, group_name, capabilities, provider_types)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET
       group_name = excluded.group_name,
       capabilities = excluded.capabilities,
       provider_types = excluded.provider_types,
       updated_at = datetime('now')
     WHERE updated_at = created_at`,
  )
  const tx = db.transaction(() => {
    for (const s of SEED_DATA) {
      insert.run(
        randomUUID(),
        s.name,
        s.group,
        JSON.stringify(s.capabilities),
        JSON.stringify(s.providerTypes),
      )
    }
    db.prepare(
      `INSERT INTO settings (key, value) VALUES ('model_definitions_seed_version', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ).run(String(SEED_VERSION))
  })
  tx()
}
