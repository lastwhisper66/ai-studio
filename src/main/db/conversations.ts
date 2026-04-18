import { v4 as uuidv4 } from 'uuid'
import type { Conversation } from '@shared/types'
import { getDb } from './database'

interface ConversationRow {
  id: string
  title: string
  created_at: string
  updated_at: string
  system_prompt: string | null
  assistant_id: string | null
  pinned: number
}

function rowToConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    systemPrompt: row.system_prompt,
    assistantId: row.assistant_id,
    pinned: row.pinned === 1,
  }
}

export function listConversations(): Conversation[] {
  const rows = getDb()
    .prepare('SELECT * FROM conversations ORDER BY pinned DESC, updated_at DESC')
    .all() as ConversationRow[]
  return rows.map(rowToConversation)
}

export function getConversation(id: string): Conversation | undefined {
  const row = getDb().prepare('SELECT * FROM conversations WHERE id = ?').get(id) as
    | ConversationRow
    | undefined
  return row ? rowToConversation(row) : undefined
}

export function createConversation(title?: string, assistantId?: string): Conversation {
  const id = uuidv4()
  const now = new Date().toISOString()
  const db = getDb()

  db.prepare(
    `INSERT INTO conversations (id, title, created_at, updated_at, assistant_id)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, title ?? 'New Chat', now, now, assistantId ?? null)

  return getConversation(id)!
}

export function updateConversation(
  id: string,
  data: Partial<Pick<Conversation, 'title' | 'systemPrompt' | 'assistantId' | 'pinned'>>,
): Conversation | undefined {
  const db = getDb()
  const now = new Date().toISOString()

  const fields: string[] = ['updated_at = ?']
  const values: unknown[] = [now]

  if (data.title !== undefined) {
    fields.push('title = ?')
    values.push(data.title)
  }
  if (data.systemPrompt !== undefined) {
    fields.push('system_prompt = ?')
    values.push(data.systemPrompt)
  }
  if (data.assistantId !== undefined) {
    fields.push('assistant_id = ?')
    values.push(data.assistantId)
  }
  if (data.pinned !== undefined) {
    fields.push('pinned = ?')
    values.push(data.pinned ? 1 : 0)
  }

  values.push(id)
  db.prepare(`UPDATE conversations SET ${fields.join(', ')} WHERE id = ?`).run(...values)

  return getConversation(id)
}

export function deleteConversation(id: string): void {
  getDb().prepare('DELETE FROM conversations WHERE id = ?').run(id)
}

export function deleteConversations(ids: string[]): void {
  if (ids.length === 0) return
  const placeholders = ids.map(() => '?').join(',')
  getDb()
    .prepare(`DELETE FROM conversations WHERE id IN (${placeholders})`)
    .run(...ids)
}

export function touchConversation(id: string): void {
  const now = new Date().toISOString()
  getDb().prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, id)
}
