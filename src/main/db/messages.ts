import { v4 as uuidv4 } from 'uuid'
import type { Message, MessageRole } from '@shared/types'
import { getDb } from './database'
import { touchConversation } from './conversations'

interface MessageRow {
  id: string
  conversation_id: string
  role: string
  content: string
  created_at: string
  token_count: number | null
}

function rowToMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role as MessageRole,
    content: row.content,
    createdAt: row.created_at,
    tokenCount: row.token_count,
  }
}

export function listMessages(conversationId: string): Message[] {
  const rows = getDb()
    .prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC')
    .all(conversationId) as MessageRow[]
  return rows.map(rowToMessage)
}

export function createMessage(conversationId: string, role: MessageRole, content: string): Message {
  const id = uuidv4()
  const now = new Date().toISOString()
  const db = getDb()

  db.prepare(
    `INSERT INTO messages (id, conversation_id, role, content, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, conversationId, role, content, now)

  // Update conversation's updated_at timestamp
  touchConversation(conversationId)

  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as MessageRow
  return rowToMessage(row)
}

export function deleteMessage(id: string): void {
  getDb().prepare('DELETE FROM messages WHERE id = ?').run(id)
}
