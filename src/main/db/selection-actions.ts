import { v4 as uuidv4 } from 'uuid'
import type { SelectionAction } from '@shared/types'
import { getDb } from './database'

interface SelectionActionRow {
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

function rowToSelectionAction(row: SelectionActionRow): SelectionAction {
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

/**
 * In-memory cache of the full action list. The selection service hits this
 * on every text-selection event (many per minute during active use), so we
 * avoid a SQL round-trip per event. Invalidated by every write path below.
 */
let cachedActions: SelectionAction[] | null = null

function invalidateCache(): void {
  cachedActions = null
}

export function listSelectionActions(): SelectionAction[] {
  if (cachedActions) return cachedActions
  const rows = getDb()
    .prepare('SELECT * FROM selection_actions ORDER BY sort_order ASC, created_at ASC')
    .all() as SelectionActionRow[]
  cachedActions = rows.map(rowToSelectionAction)
  return cachedActions
}

export function getSelectionAction(id: string): SelectionAction | undefined {
  const row = getDb().prepare('SELECT * FROM selection_actions WHERE id = ?').get(id) as
    | SelectionActionRow
    | undefined
  return row ? rowToSelectionAction(row) : undefined
}

export function createSelectionAction(data: {
  name: string
  description?: string
  systemPrompt?: string
  icon?: string
}): SelectionAction {
  const id = uuidv4()
  const now = new Date().toISOString()
  const db = getDb()
  const insert = db.transaction(() => {
    const maxRow = db
      .prepare('SELECT COALESCE(MAX(sort_order), 0) as max FROM selection_actions')
      .get() as { max: number }
    const sortOrder = maxRow.max + 1
    db.prepare(
      `INSERT INTO selection_actions (id, name, description, system_prompt, icon, sort_order, created_at, updated_at)
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
  invalidateCache()
  const row = db
    .prepare('SELECT * FROM selection_actions WHERE id = ?')
    .get(id) as SelectionActionRow
  return rowToSelectionAction(row)
}

const UPDATABLE_COLUMNS = {
  name: 'name',
  description: 'description',
  systemPrompt: 'system_prompt',
  icon: 'icon',
  enabled: 'enabled',
} as const satisfies Record<string, string>

type UpdatableKey = keyof typeof UPDATABLE_COLUMNS
const BOOL_KEYS = new Set<UpdatableKey>(['enabled'])

export function updateSelectionAction(
  id: string,
  data: Partial<Pick<SelectionAction, UpdatableKey>>,
): SelectionAction | undefined {
  const db = getDb()
  const setClauses: string[] = []
  const values: unknown[] = []

  for (const [prop, column] of Object.entries(UPDATABLE_COLUMNS)) {
    const val = data[prop as UpdatableKey]
    if (val === undefined) continue
    setClauses.push(`${column} = ?`)
    values.push(BOOL_KEYS.has(prop as UpdatableKey) ? (val ? 1 : 0) : val)
  }

  if (setClauses.length === 0) return undefined

  setClauses.push('updated_at = ?')
  values.push(new Date().toISOString())
  values.push(id)

  const sql = `UPDATE selection_actions SET ${setClauses.join(', ')} WHERE id = ?`
  db.prepare(sql).run(...values)
  invalidateCache()

  const row = db.prepare('SELECT * FROM selection_actions WHERE id = ?').get(id) as
    | SelectionActionRow
    | undefined
  return row ? rowToSelectionAction(row) : undefined
}

export function deleteSelectionAction(id: string): void {
  getDb().prepare('DELETE FROM selection_actions WHERE id = ? AND is_builtin = 0').run(id)
  invalidateCache()
}

export function reorderSelectionActions(ids: string[]): void {
  const db = getDb()
  const stmt = db.prepare('UPDATE selection_actions SET sort_order = ? WHERE id = ?')
  const reorder = db.transaction(() => {
    ids.forEach((id, index) => stmt.run(index, id))
  })
  reorder()
  invalidateCache()
}

export function seedSelectionActions(): void {
  const db = getDb()
  const now = new Date().toISOString()
  const builtins = [
    {
      id: 'builtin-sel-translate',
      name: 'seed.selectionActions.translate.name',
      description: 'seed.selectionActions.translate.description',
      systemPrompt:
        'You are a professional translator. Translate the input text into the language specified in the follow-up instruction. If the input is already in that language, output it unchanged. Only output the translation, nothing else. Preserve the original formatting and tone.',
      icon: 'Languages',
      sortOrder: 0,
    },
    {
      id: 'builtin-sel-explain',
      name: 'seed.selectionActions.explain.name',
      description: 'seed.selectionActions.explain.description',
      systemPrompt:
        'You are an expert explainer. Clearly and concisely explain the meaning, concept, or context of the given text.',
      icon: 'BookOpen',
      sortOrder: 1,
    },
    {
      id: 'builtin-sel-summarize',
      name: 'seed.selectionActions.summarize.name',
      description: 'seed.selectionActions.summarize.description',
      systemPrompt:
        'You are a summarization expert. Provide a clear, concise summary that captures the key points of the input text. Use bullet points when it improves clarity.',
      icon: 'FileText',
      sortOrder: 2,
    },
    {
      id: 'builtin-sel-rewrite',
      name: 'seed.selectionActions.polish.name',
      description: 'seed.selectionActions.polish.description',
      systemPrompt:
        'You are a professional editor. Rewrite the given text to be clearer, more fluent, and more polished while preserving its original meaning and tone. Only output the rewritten text.',
      icon: 'Wand2',
      sortOrder: 3,
    },
  ]

  const stmt = db.prepare(
    `INSERT OR IGNORE INTO selection_actions (id, name, description, system_prompt, icon, is_builtin, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
  )
  // Only insert if the row doesn't exist — never overwrite user edits to
  // built-in prompts on app restart.
  const seed = db.transaction(() => {
    for (const b of builtins) {
      stmt.run(b.id, b.name, b.description, b.systemPrompt, b.icon, b.sortOrder, now, now)
    }
  })
  seed()
  invalidateCache()
}
