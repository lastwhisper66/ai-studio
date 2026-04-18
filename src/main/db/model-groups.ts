import { randomUUID } from 'crypto'
import type { ModelGroup } from '@shared/types'
import { getDb } from './database'

interface ModelGroupRow {
  id: string
  pattern: string
  display_name: string
  sort_order: number
  created_at: string
  updated_at: string
}

function rowToModelGroup(row: ModelGroupRow): ModelGroup {
  return {
    id: row.id,
    pattern: row.pattern,
    displayName: row.display_name,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function listModelGroups(): ModelGroup[] {
  const rows = getDb()
    .prepare('SELECT * FROM model_groups ORDER BY sort_order ASC, display_name ASC')
    .all() as ModelGroupRow[]
  return rows.map(rowToModelGroup)
}

export function getModelGroup(id: string): ModelGroup | undefined {
  const row = getDb().prepare('SELECT * FROM model_groups WHERE id = ?').get(id) as
    | ModelGroupRow
    | undefined
  if (!row) return undefined
  return rowToModelGroup(row)
}

export interface CreateModelGroupData {
  pattern: string
  displayName: string
  sortOrder?: number
}

export function createModelGroup(data: CreateModelGroupData): ModelGroup {
  const id = randomUUID()
  getDb()
    .prepare(
      `INSERT INTO model_groups (id, pattern, display_name, sort_order)
       VALUES (?, ?, ?, ?)`,
    )
    .run(id, data.pattern, data.displayName, data.sortOrder ?? 0)
  return getModelGroup(id)!
}

export interface UpdateModelGroupData {
  pattern?: string
  displayName?: string
  sortOrder?: number
}

export function updateModelGroup(id: string, data: UpdateModelGroupData): ModelGroup | undefined {
  const fields: string[] = []
  const values: unknown[] = []

  if (data.pattern !== undefined) {
    fields.push('pattern = ?')
    values.push(data.pattern)
  }
  if (data.displayName !== undefined) {
    fields.push('display_name = ?')
    values.push(data.displayName)
  }
  if (data.sortOrder !== undefined) {
    fields.push('sort_order = ?')
    values.push(data.sortOrder)
  }

  if (fields.length === 0) return getModelGroup(id)

  fields.push("updated_at = datetime('now')")
  values.push(id)
  // Safety: `fields` only contains hardcoded column assignments — no user input is interpolated
  getDb()
    .prepare(`UPDATE model_groups SET ${fields.join(', ')} WHERE id = ?`)
    .run(...values)

  return getModelGroup(id)
}

export function deleteModelGroup(id: string): void {
  getDb().prepare('DELETE FROM model_groups WHERE id = ?').run(id)
}

/**
 * Resolve a model group for a given model name using two-level matching:
 *   1. Exact match  (pattern = modelName)
 *   2. Prefix match (modelName starts with pattern) → longest pattern wins
 */
export function resolveModelGroup(modelName: string): ModelGroup | undefined {
  const all = listModelGroups()
  const lower = modelName.toLowerCase()

  // Level 1: exact match
  const exact = all.find((g) => g.pattern.toLowerCase() === lower)
  if (exact) return exact

  // Level 2: prefix match — longest pattern wins
  const prefixCandidates = all.filter((g) => lower.startsWith(g.pattern.toLowerCase()))
  if (prefixCandidates.length > 0) {
    return prefixCandidates.reduce((best, cur) =>
      cur.pattern.length > best.pattern.length ? cur : best,
    )
  }

  return undefined
}

/* ─── Seed ─── */

const SEED_VERSION = 1

interface SeedEntry {
  pattern: string
  displayName: string
}

import seedData from './seed-model-groups.json'
const SEED_DATA: SeedEntry[] = seedData as SeedEntry[]

export function seedModelGroups(): void {
  const db = getDb()

  const row = db
    .prepare("SELECT value FROM settings WHERE key = 'model_groups_seed_version'")
    .get() as { value: string } | undefined
  const currentVersion = row ? Number(row.value) : 0
  if (currentVersion >= SEED_VERSION) return

  const insert = db.prepare(
    `INSERT INTO model_groups (id, pattern, display_name)
     VALUES (?, ?, ?)
     ON CONFLICT(pattern) DO UPDATE SET
       display_name = excluded.display_name,
       updated_at = datetime('now')
     WHERE updated_at = created_at`,
  )
  const tx = db.transaction(() => {
    for (const s of SEED_DATA) {
      insert.run(randomUUID(), s.pattern, s.displayName)
    }
    db.prepare(
      `INSERT INTO settings (key, value) VALUES ('model_groups_seed_version', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ).run(String(SEED_VERSION))
  })
  tx()
}
