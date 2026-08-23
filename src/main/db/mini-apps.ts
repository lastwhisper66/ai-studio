import { v4 as uuidv4 } from 'uuid'
import type { MiniApp } from '@shared/types'
import { getDb } from './database'
import { MINI_APPS } from '../builtins'

interface MiniAppRow {
  id: string
  name: string
  url: string
  icon: string
  color: string
  user_agent: string
  is_builtin: number
  sort_order: number
  enabled: number
  created_at: string
  updated_at: string
}

function rowToMiniApp(row: MiniAppRow): MiniApp {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    icon: row.icon,
    color: row.color,
    userAgent: row.user_agent,
    isBuiltin: row.is_builtin === 1,
    sortOrder: row.sort_order,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function listMiniApps(): MiniApp[] {
  const rows = getDb()
    .prepare('SELECT * FROM mini_apps ORDER BY sort_order ASC, created_at ASC')
    .all() as MiniAppRow[]
  return rows.map(rowToMiniApp)
}

export function getMiniApp(id: string): MiniApp | undefined {
  const row = getDb().prepare('SELECT * FROM mini_apps WHERE id = ?').get(id) as
    | MiniAppRow
    | undefined
  return row ? rowToMiniApp(row) : undefined
}

export function createMiniApp(data: {
  name: string
  url: string
  icon?: string
  color?: string
  userAgent?: string
}): MiniApp {
  const id = uuidv4()
  const now = new Date().toISOString()
  const db = getDb()
  const insert = db.transaction(() => {
    const maxRow = db
      .prepare('SELECT COALESCE(MAX(sort_order), 0) as max FROM mini_apps')
      .get() as { max: number }
    const sortOrder = maxRow.max + 1
    db.prepare(
      `INSERT INTO mini_apps (id, name, url, icon, color, user_agent, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      data.name,
      data.url,
      // Fall back to the first character of the name so a user-added app always
      // renders a legible tile even when they skip the icon field.
      data.icon ?? data.name.trim().charAt(0).toUpperCase(),
      data.color ?? '#6366f1',
      data.userAgent ?? '',
      sortOrder,
      now,
      now,
    )
  })
  insert()
  const row = db.prepare('SELECT * FROM mini_apps WHERE id = ?').get(id) as MiniAppRow
  return rowToMiniApp(row)
}

/** Allowed property → column mappings for mini_app updates */
const UPDATABLE_COLUMNS = {
  name: 'name',
  url: 'url',
  icon: 'icon',
  color: 'color',
  userAgent: 'user_agent',
  enabled: 'enabled',
} as const satisfies Record<string, string>

type UpdatableKey = keyof typeof UPDATABLE_COLUMNS

export function updateMiniApp(
  id: string,
  data: Partial<Pick<MiniApp, UpdatableKey>>,
): MiniApp | undefined {
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

  const sql = `UPDATE mini_apps SET ${setClauses.join(', ')} WHERE id = ?`
  db.prepare(sql).run(...values)

  const row = db.prepare('SELECT * FROM mini_apps WHERE id = ?').get(id) as MiniAppRow | undefined
  return row ? rowToMiniApp(row) : undefined
}

export function deleteMiniApp(id: string): void {
  getDb().prepare('DELETE FROM mini_apps WHERE id = ? AND is_builtin = 0').run(id)
}

export function reorderMiniApps(ids: string[]): void {
  const db = getDb()
  const stmt = db.prepare('UPDATE mini_apps SET sort_order = ? WHERE id = ?')
  const reorder = db.transaction(() => {
    ids.forEach((id, index) => stmt.run(index, id))
  })
  reorder()
}

export function seedMiniApps(): void {
  const db = getDb()
  const now = new Date().toISOString()
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO mini_apps (id, name, url, icon, color, is_builtin, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
  )
  // Only insert missing built-ins; existing rows may carry user edits.
  const seed = db.transaction(() => {
    for (const b of MINI_APPS) {
      stmt.run(b.id, b.name, b.url, b.icon, b.color, b.sortOrder, now, now)
    }
  })
  seed()
}

/** Force-overwrite every is_builtin=1 mini_app row with current source values. */
export function applyBuiltinMiniAppsUpdate(): void {
  const db = getDb()
  const stmt = db.prepare(
    `UPDATE mini_apps SET
       name = ?, url = ?, icon = ?, color = ?, sort_order = ?,
       updated_at = datetime('now')
     WHERE id = ? AND is_builtin = 1`,
  )
  db.transaction(() => {
    for (const b of MINI_APPS) {
      stmt.run(b.name, b.url, b.icon, b.color, b.sortOrder, b.id)
    }
  })()
}
