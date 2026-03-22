import { v4 as uuidv4 } from 'uuid'
import type { Phrase } from '@shared/types'
import { getDb } from './database'

interface PhraseRow {
  id: string
  title: string
  content: string
  sort_order: number
  created_at: string
}

function rowToPhrase(row: PhraseRow): Phrase {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  }
}

export function listPhrases(): Phrase[] {
  const rows = getDb()
    .prepare('SELECT * FROM phrases ORDER BY sort_order ASC, created_at ASC')
    .all() as PhraseRow[]
  return rows.map(rowToPhrase)
}

export function createPhrase(title: string, content: string): Phrase {
  const id = uuidv4()
  const now = new Date().toISOString()
  const db = getDb()
  const insert = db.transaction(() => {
    const maxRow = db.prepare('SELECT COALESCE(MAX(sort_order), 0) as max FROM phrases').get() as { max: number }
    const sortOrder = maxRow.max + 1
    db.prepare(
      'INSERT INTO phrases (id, title, content, sort_order, created_at) VALUES (?, ?, ?, ?, ?)',
    ).run(id, title, content, sortOrder, now)
  })
  insert()
  const row = db.prepare('SELECT * FROM phrases WHERE id = ?').get(id) as PhraseRow
  return rowToPhrase(row)
}

export function updatePhrase(id: string, data: Partial<Pick<Phrase, 'title' | 'content'>>): Phrase | undefined {
  const db = getDb()
  const fields: string[] = []
  const values: unknown[] = []
  if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title) }
  if (data.content !== undefined) { fields.push('content = ?'); values.push(data.content) }
  if (fields.length === 0) return undefined
  values.push(id)
  db.prepare(`UPDATE phrases SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  const row = db.prepare('SELECT * FROM phrases WHERE id = ?').get(id) as PhraseRow | undefined
  return row ? rowToPhrase(row) : undefined
}

export function deletePhrase(id: string): void {
  getDb().prepare('DELETE FROM phrases WHERE id = ?').run(id)
}
