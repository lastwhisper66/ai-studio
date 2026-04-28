import { v4 as uuidv4 } from 'uuid'
import type {
  Message,
  MessageRole,
  AttachmentMeta,
  ToolCallData,
  ToolCallResultData,
} from '@shared/types'
import { ERROR_CODES } from '@shared/errors'
import { AppError } from '../errors'
import { getDb } from './database'
import { touchConversation } from './conversations'

interface MessageRow {
  id: string
  conversation_id: string
  role: string
  content: string
  reasoning_content: string | null
  created_at: string
  token_count: number | null
  duration: number | null
  thinking_duration: number | null
  attachments: string | null
  tool_calls: string | null
  tool_results: string | null
}

function rowToMessage(row: MessageRow): Message {
  const msg: Message = {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role as MessageRole,
    content: row.content,
    reasoningContent: row.reasoning_content,
    createdAt: row.created_at,
    tokenCount: row.token_count,
    duration: row.duration,
    thinkingDuration: row.thinking_duration,
  }
  if (row.attachments) {
    try {
      msg.attachments = JSON.parse(row.attachments) as AttachmentMeta[]
    } catch {
      // ignore malformed JSON
    }
  }
  if (row.tool_calls) {
    try {
      msg.toolCalls = JSON.parse(row.tool_calls) as ToolCallData[]
    } catch {
      /* ignore */
    }
  }
  if (row.tool_results) {
    try {
      msg.toolResults = JSON.parse(row.tool_results) as ToolCallResultData[]
    } catch {
      /* ignore */
    }
  }
  return msg
}

export function listMessages(conversationId: string): Message[] {
  const rows = getDb()
    .prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC')
    .all(conversationId) as MessageRow[]
  return rows.map(rowToMessage)
}

export function listMessagesPaginated(
  conversationId: string,
  limit: number = 50,
  beforeCreatedAt?: string,
): { messages: Message[]; hasMore: boolean } {
  const db = getDb()
  let rows: MessageRow[]

  if (beforeCreatedAt) {
    rows = db
      .prepare(
        'SELECT * FROM messages WHERE conversation_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?',
      )
      .all(conversationId, beforeCreatedAt, limit + 1) as MessageRow[]
  } else {
    rows = db
      .prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(conversationId, limit + 1) as MessageRow[]
  }

  const hasMore = rows.length > limit
  if (hasMore) rows.pop()

  return {
    messages: rows.reverse().map(rowToMessage),
    hasMore,
  }
}

interface CreateMessageOptions {
  attachments?: AttachmentMeta[]
  duration?: number
  reasoningContent?: string
  thinkingDuration?: number
  toolCalls?: ToolCallData[]
  toolResults?: ToolCallResultData[]
}

export function createMessage(
  conversationId: string,
  role: MessageRole,
  content: string,
  options?: CreateMessageOptions,
): Message {
  const { attachments, duration, reasoningContent, thinkingDuration, toolCalls, toolResults } =
    options ?? {}
  const id = uuidv4()
  const now = new Date().toISOString()
  const db = getDb()
  const attachmentsJson = attachments && attachments.length > 0 ? JSON.stringify(attachments) : null
  const toolCallsJson = toolCalls && toolCalls.length > 0 ? JSON.stringify(toolCalls) : null
  const toolResultsJson = toolResults && toolResults.length > 0 ? JSON.stringify(toolResults) : null

  db.prepare(
    `INSERT INTO messages (id, conversation_id, role, content, reasoning_content, created_at, attachments, duration, thinking_duration, tool_calls, tool_results)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    conversationId,
    role,
    content,
    reasoningContent || null,
    now,
    attachmentsJson,
    duration ?? null,
    thinkingDuration ?? null,
    toolCallsJson,
    toolResultsJson,
  )

  // Update conversation's updated_at timestamp
  touchConversation(conversationId)

  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as MessageRow
  return rowToMessage(row)
}

export function deleteMessage(id: string): void {
  getDb().prepare('DELETE FROM messages WHERE id = ?').run(id)
}

export function updateMessageContent(id: string, content: string): Message {
  const db = getDb()
  const updateMessage = db.transaction(() => {
    const info = db.prepare('UPDATE messages SET content = ? WHERE id = ?').run(content, id)
    if (info.changes === 0) return null

    // Touch conversation to update updated_at
    const row = db.prepare('SELECT conversation_id FROM messages WHERE id = ?').get(id) as
      | { conversation_id: string }
      | undefined
    if (row) touchConversation(row.conversation_id)

    return db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as MessageRow
  })

  const updated = updateMessage()
  if (!updated) throw new AppError(ERROR_CODES.MESSAGE_NOT_FOUND, { id })
  return rowToMessage(updated)
}

export function getMessageAttachments(
  conversationId: string,
): { id: string; attachments: string }[] {
  return getDb()
    .prepare(
      'SELECT id, attachments FROM messages WHERE conversation_id = ? AND attachments IS NOT NULL',
    )
    .all(conversationId) as { id: string; attachments: string }[]
}

export function clearConversationMessages(conversationId: string): void {
  getDb().prepare('DELETE FROM messages WHERE conversation_id = ?').run(conversationId)
}

export function insertDivider(conversationId: string): Message {
  return createMessage(conversationId, 'divider', '')
}
