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
 * Seed the model_definitions table with built-in catalog data.
 * Uses a version number stored in the settings table so that new models
 * added in future app releases are merged in without overwriting user edits.
 * INSERT OR IGNORE ensures existing (user-modified) rows are never touched.
 */

const SEED_VERSION = 1

type SeedEntry = {
  name: string
  group: string
  capabilities: ModelCapability[]
  providerTypes: ProviderType[]
}

const SEED_DATA: SeedEntry[] = [
  // ── OpenAI ──────────────────────────────────────────
  {
    name: 'gpt-5.1',
    group: 'GPT-5.1',
    capabilities: ['reasoning', 'vision', 'tools', 'web'],
    providerTypes: ['openai'],
  },
  {
    name: 'gpt-5.4-mini',
    group: 'GPT-5.4',
    capabilities: ['reasoning', 'vision', 'tools', 'web'],
    providerTypes: ['openai'],
  },
  {
    name: 'gpt-5.4',
    group: 'GPT-5.4',
    capabilities: ['reasoning', 'vision', 'tools', 'web'],
    providerTypes: ['openai'],
  },
  {
    name: 'gpt-5.4-mini',
    group: 'GPT-5.4',
    capabilities: ['reasoning', 'vision', 'tools', 'web'],
    providerTypes: ['openai'],
  },
  {
    name: 'gpt-5.3-codex',
    group: 'GPT-5',
    capabilities: ['reasoning', 'vision', 'web', 'tools'],
    providerTypes: ['openai'],
  },
  // ── DeepSeek ────────────────────────────────────────
  {
    name: 'deepseek-chat',
    group: 'DeepSeek-V3.2',
    capabilities: ['tools'],
    providerTypes: ['deepseek'],
  },
  {
    name: 'deepseek-reasoner',
    group: 'DeepSeek-V3.2',
    capabilities: ['reasoning'],
    providerTypes: ['deepseek'],
  },
  // ── Claude ──────────────────────────────────────────
  {
    name: 'claude-opus-4-6',
    group: 'Claude 4.6',
    capabilities: ['reasoning', 'vision', 'tools'],
    providerTypes: ['anthropic'],
  },
  {
    name: 'claude-sonnet-4-6',
    group: 'Claude 4.6',
    capabilities: ['reasoning', 'vision', 'tools'],
    providerTypes: ['anthropic'],
  },
  {
    name: 'claude-haiku-4-5-20251015',
    group: 'Claude 4.5',
    capabilities: ['reasoning', 'vision', 'tools'],
    providerTypes: ['anthropic'],
  },
  // ── Gemini ──────────────────────────────────────────
  // providerTypes: [] → visible to all providers (no dedicated 'google' provider type yet)
  {
    name: 'gemini-3.1-pro-preview',
    group: 'Gemini 3',
    capabilities: ['reasoning', 'vision', 'tools'],
    providerTypes: [],
  },
  {
    name: 'gemini-3-flash-preview',
    group: 'Gemini 3',
    capabilities: ['reasoning', 'vision', 'tools'],
    providerTypes: [],
  },
  // ── Silicon Flow ────────────────────────────────────
  {
    name: 'deepseek-ai/DeepSeek-V3.2',
    group: 'DeepSeek',
    capabilities: ['tools'],
    providerTypes: ['silicon'],
  },
  {
    name: 'deepseek-ai/DeepSeek-R1',
    group: 'DeepSeek',
    capabilities: ['reasoning'],
    providerTypes: ['silicon'],
  },
  {
    name: 'Pro/zai-org/GLM-5',
    group: 'GLM (Pro)',
    capabilities: ['tools'],
    providerTypes: ['silicon'],
  },
]

export function seedModelDefinitions(): void {
  const db = getDb()

  const row = db
    .prepare("SELECT value FROM settings WHERE key = 'model_definitions_seed_version'")
    .get() as { value: string } | undefined
  const currentVersion = row ? Number(row.value) : 0
  if (currentVersion >= SEED_VERSION) return

  const insert = db.prepare(
    `INSERT OR IGNORE INTO model_definitions (id, name, group_name, capabilities, provider_types)
     VALUES (?, ?, ?, ?, ?)`,
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
