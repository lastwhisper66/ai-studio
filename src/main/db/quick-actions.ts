import { v4 as uuidv4 } from 'uuid'
import type { QuickAction } from '@shared/types'
import { getDb } from './database'
import { QUICK_ACTION_SEEDS } from './seeds/actions'

interface QuickActionRow {
  id: string
  name: string
  description: string
  system_prompt: string
  icon: string
  is_builtin: number
  sort_order: number
  enabled: number
  created_at: string
  updated_at: string
}

function rowToQuickAction(row: QuickActionRow): QuickAction {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    systemPrompt: row.system_prompt,
    icon: row.icon,
    isBuiltin: row.is_builtin === 1,
    sortOrder: row.sort_order,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function listQuickActions(): QuickAction[] {
  const rows = getDb()
    .prepare('SELECT * FROM quick_actions ORDER BY sort_order ASC, created_at ASC')
    .all() as QuickActionRow[]
  return rows.map(rowToQuickAction)
}

export function getQuickAction(id: string): QuickAction | undefined {
  const row = getDb().prepare('SELECT * FROM quick_actions WHERE id = ?').get(id) as
    | QuickActionRow
    | undefined
  return row ? rowToQuickAction(row) : undefined
}

export function createQuickAction(data: {
  name: string
  description?: string
  systemPrompt?: string
  icon?: string
}): QuickAction {
  const id = uuidv4()
  const now = new Date().toISOString()
  const db = getDb()
  const insert = db.transaction(() => {
    const maxRow = db
      .prepare('SELECT COALESCE(MAX(sort_order), 0) as max FROM quick_actions')
      .get() as { max: number }
    const sortOrder = maxRow.max + 1
    db.prepare(
      `INSERT INTO quick_actions (id, name, description, system_prompt, icon, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      data.name,
      data.description ?? '',
      data.systemPrompt ?? '',
      data.icon ?? 'Sparkles',
      sortOrder,
      now,
      now,
    )
  })
  insert()
  const row = db.prepare('SELECT * FROM quick_actions WHERE id = ?').get(id) as QuickActionRow
  return rowToQuickAction(row)
}

/** Allowed property → column mappings for quick_action updates */
const UPDATABLE_COLUMNS = {
  name: 'name',
  description: 'description',
  systemPrompt: 'system_prompt',
  icon: 'icon',
  enabled: 'enabled',
} as const satisfies Record<string, string>

type UpdatableKey = keyof typeof UPDATABLE_COLUMNS

export function updateQuickAction(
  id: string,
  data: Partial<Pick<QuickAction, UpdatableKey>>,
): QuickAction | undefined {
  const db = getDb()
  const setClauses: string[] = []
  const values: unknown[] = []

  for (const [prop, column] of Object.entries(UPDATABLE_COLUMNS)) {
    const val = data[prop as UpdatableKey]
    if (val === undefined) continue
    setClauses.push(`${column} = ?`)
    values.push(prop === 'enabled' ? (val ? 1 : 0) : val)
  }

  if (setClauses.length === 0) return undefined

  setClauses.push("updated_at = datetime('now')")
  values.push(id)

  const sql = `UPDATE quick_actions SET ${setClauses.join(', ')} WHERE id = ?`
  db.prepare(sql).run(...values)

  const row = db.prepare('SELECT * FROM quick_actions WHERE id = ?').get(id) as
    | QuickActionRow
    | undefined
  return row ? rowToQuickAction(row) : undefined
}

export function deleteQuickAction(id: string): void {
  getDb().prepare('DELETE FROM quick_actions WHERE id = ? AND is_builtin = 0').run(id)
}

export function reorderQuickActions(ids: string[]): void {
  const db = getDb()
  const stmt = db.prepare('UPDATE quick_actions SET sort_order = ? WHERE id = ?')
  const reorder = db.transaction(() => {
    ids.forEach((id, index) => stmt.run(index, id))
  })
  reorder()
}

export function seedQuickActions(): void {
  const db = getDb()
  const now = new Date().toISOString()
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO quick_actions (id, name, description, system_prompt, icon, is_builtin, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
  )
  // Only insert missing built-ins; existing rows may contain user-edited prompts.
  const seed = db.transaction(() => {
    for (const b of QUICK_ACTION_SEEDS) {
      stmt.run(b.id, b.name, b.description, b.systemPrompt, b.icon, b.sortOrder, now, now)
    }
  })
  seed()
}

const OLD_TRANSLATE_PROMPTS = [
  'You are a professional translator. Translate the input text into the language specified in the follow-up instruction. If the input is already in that language, output it unchanged. Only output the translation, nothing else. Preserve the original formatting and tone.',
]

const OLD_IMAGE_TRANSLATE_PROMPTS = [
  'You are a professional translator. Translate the text or image content sent by the user into the language specified in the follow-up instruction. If the content is already in that language, output it unchanged. Only output the translation, nothing else.',
]

export function migrateBuiltinTranslatePrompts(): void {
  const db = getDb()
  for (const seed of QUICK_ACTION_SEEDS) {
    if (!seed.id.includes('translate')) continue
    const oldPrompts =
      seed.id === 'builtin-image-translate' ? OLD_IMAGE_TRANSLATE_PROMPTS : OLD_TRANSLATE_PROMPTS
    for (const oldPrompt of oldPrompts) {
      db.prepare(
        `UPDATE quick_actions SET system_prompt = ?, updated_at = datetime('now')
         WHERE id = ? AND is_builtin = 1 AND system_prompt = ?`,
      ).run(seed.systemPrompt, seed.id, oldPrompt)
    }
  }
}
