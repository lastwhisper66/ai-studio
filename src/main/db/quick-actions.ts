import { v4 as uuidv4 } from 'uuid'
import type { QuickAction } from '@shared/types'
import { generateTranslatePrompt, generateImageTranslatePrompt } from '@shared/languages'
import { getDb } from './database'

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
  const builtins = [
    {
      id: 'builtin-answer',
      name: 'seed.quickActions.answer.name',
      description: 'seed.quickActions.answer.description',
      systemPrompt:
        "You are a knowledgeable and helpful assistant. Answer the user's question clearly, accurately, and concisely. Always respond in the same language as the user's input.",
      icon: 'MessageCircle',
      sortOrder: 0,
    },
    {
      id: 'builtin-translate',
      name: 'seed.quickActions.translate.name',
      description: 'seed.quickActions.translate.description',
      systemPrompt: generateTranslatePrompt('the target language'),
      icon: 'Languages',
      sortOrder: 1,
    },
    {
      id: 'builtin-summary',
      name: 'seed.quickActions.summarize.name',
      description: 'seed.quickActions.summarize.description',
      systemPrompt:
        'You are a summarization expert. Provide a clear, concise summary that captures all key points of the input text. Respond in the same language as the input. Use bullet points or structured format when it improves clarity.',
      icon: 'FileText',
      sortOrder: 2,
    },
    {
      id: 'builtin-image-translate',
      name: 'seed.quickActions.imageTranslate.name',
      description: 'seed.quickActions.imageTranslate.description',
      systemPrompt: generateImageTranslatePrompt('the target language'),
      icon: 'ScanText',
      sortOrder: 3,
    },
  ]

  const stmt = db.prepare(
    `INSERT OR IGNORE INTO quick_actions (id, name, description, system_prompt, icon, is_builtin, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
  )
  const updateStmt = db.prepare(
    `UPDATE quick_actions SET system_prompt = ? WHERE id = ? AND is_builtin = 1`,
  )
  const seed = db.transaction(() => {
    for (const b of builtins) {
      stmt.run(b.id, b.name, b.description, b.systemPrompt, b.icon, b.sortOrder, now, now)
      updateStmt.run(b.systemPrompt, b.id)
    }
  })
  seed()
}
