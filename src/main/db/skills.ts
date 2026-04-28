import { randomUUID } from 'crypto'
import type { Skill, CreateSkillPayload, UpdateSkillPayload } from '@shared/types'
import { getDb } from './database'

interface SkillRow {
  id: string
  name: string
  description: string
  icon: string
  system_prompt: string
  provider_id: string | null
  model: string
  tool_server_ids: string
  is_builtin: number
  enabled: number
  sort_order: number
  created_at: string
  updated_at: string
}

function rowToSkill(row: SkillRow): Skill {
  let toolServerIds: string[] = []
  try {
    toolServerIds = JSON.parse(row.tool_server_ids)
  } catch {
    toolServerIds = []
  }
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    systemPrompt: row.system_prompt,
    providerId: row.provider_id,
    model: row.model,
    toolServerIds,
    isBuiltin: !!row.is_builtin,
    enabled: !!row.enabled,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function listSkills(): Skill[] {
  const rows = getDb()
    .prepare('SELECT * FROM skills ORDER BY sort_order ASC, created_at ASC')
    .all() as SkillRow[]
  return rows.map(rowToSkill)
}

export function getSkill(id: string): Skill | undefined {
  const row = getDb().prepare('SELECT * FROM skills WHERE id = ?').get(id) as SkillRow | undefined
  if (!row) return undefined
  return rowToSkill(row)
}

export function createSkill(data: CreateSkillPayload): Skill {
  const id = randomUUID()
  const toolServerIds = JSON.stringify(data.toolServerIds ?? [])
  getDb()
    .prepare(
      `INSERT INTO skills (id, name, description, icon, system_prompt, provider_id, model, tool_server_ids, enabled, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      data.name,
      data.description ?? '',
      data.icon ?? '',
      data.systemPrompt ?? '',
      data.providerId ?? null,
      data.model ?? '',
      toolServerIds,
      data.enabled !== undefined ? (data.enabled ? 1 : 0) : 1,
      data.sortOrder ?? 0,
    )
  return getSkill(id)!
}

export function updateSkill(id: string, data: UpdateSkillPayload): Skill | undefined {
  const fields: string[] = []
  const values: unknown[] = []

  if (data.name !== undefined) {
    fields.push('name = ?')
    values.push(data.name)
  }
  if (data.description !== undefined) {
    fields.push('description = ?')
    values.push(data.description)
  }
  if (data.icon !== undefined) {
    fields.push('icon = ?')
    values.push(data.icon)
  }
  if (data.systemPrompt !== undefined) {
    fields.push('system_prompt = ?')
    values.push(data.systemPrompt)
  }
  if (data.providerId !== undefined) {
    fields.push('provider_id = ?')
    values.push(data.providerId)
  }
  if (data.model !== undefined) {
    fields.push('model = ?')
    values.push(data.model)
  }
  if (data.toolServerIds !== undefined) {
    fields.push('tool_server_ids = ?')
    values.push(JSON.stringify(data.toolServerIds))
  }
  if (data.enabled !== undefined) {
    fields.push('enabled = ?')
    values.push(data.enabled ? 1 : 0)
  }
  if (data.sortOrder !== undefined) {
    fields.push('sort_order = ?')
    values.push(data.sortOrder)
  }

  if (fields.length === 0) return getSkill(id)

  fields.push("updated_at = datetime('now')")
  values.push(id)

  getDb()
    .prepare(`UPDATE skills SET ${fields.join(', ')} WHERE id = ?`)
    .run(...values)

  return getSkill(id)
}

export function deleteSkill(id: string): void {
  getDb().prepare('DELETE FROM skills WHERE id = ?').run(id)
}

export function reorderSkills(ids: string[]): void {
  const db = getDb()
  const update = db.prepare('UPDATE skills SET sort_order = ? WHERE id = ?')
  db.transaction(() => {
    ids.forEach((id, i) => update.run(i, id))
  })()
}
