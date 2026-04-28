import { randomUUID } from 'crypto'
import type { ToolCallAuditEntry, ToolCallAuditFilter } from '@shared/types'
import { getDb } from './database'

interface AuditLogRow {
  id: string
  conversation_id: string
  server_id: string
  server_name: string
  tool_name: string
  arguments: string
  result: string | null
  status: string
  is_error: number
  duration_ms: number | null
  round_index: number
  created_at: string
}

function rowToAuditEntry(row: AuditLogRow): ToolCallAuditEntry {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    serverId: row.server_id,
    serverName: row.server_name,
    toolName: row.tool_name,
    arguments: JSON.parse(row.arguments) as Record<string, unknown>,
    result: row.result ? (JSON.parse(row.result) as unknown[]) : null,
    status: row.status as ToolCallAuditEntry['status'],
    isError: row.is_error === 1,
    durationMs: row.duration_ms,
    roundIndex: row.round_index,
    createdAt: row.created_at,
  }
}

export interface CreateAuditEntryData {
  conversationId: string
  serverId: string
  serverName: string
  toolName: string
  arguments: Record<string, unknown>
  result: unknown[] | null
  status: 'completed' | 'error' | 'rejected'
  isError: boolean
  durationMs: number | null
  roundIndex: number
}

export function createAuditEntry(data: CreateAuditEntryData): ToolCallAuditEntry {
  const id = randomUUID()
  getDb()
    .prepare(
      `INSERT INTO tool_call_audit_log
       (id, conversation_id, server_id, server_name, tool_name, arguments, result, status, is_error, duration_ms, round_index)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      data.conversationId,
      data.serverId,
      data.serverName,
      data.toolName,
      JSON.stringify(data.arguments),
      data.result ? JSON.stringify(data.result) : null,
      data.status,
      data.isError ? 1 : 0,
      data.durationMs,
      data.roundIndex,
    )
  return getAuditEntry(id)!
}

export function getAuditEntry(id: string): ToolCallAuditEntry | undefined {
  const row = getDb().prepare('SELECT * FROM tool_call_audit_log WHERE id = ?').get(id) as
    | AuditLogRow
    | undefined
  if (!row) return undefined
  return rowToAuditEntry(row)
}

export function listAuditEntries(filter: ToolCallAuditFilter = {}): {
  entries: ToolCallAuditEntry[]
  total: number
} {
  const conditions: string[] = []
  const params: unknown[] = []

  if (filter.conversationId) {
    conditions.push('conversation_id = ?')
    params.push(filter.conversationId)
  }
  if (filter.serverId) {
    conditions.push('server_id = ?')
    params.push(filter.serverId)
  }
  if (filter.toolName) {
    conditions.push('tool_name LIKE ?')
    params.push(`%${filter.toolName}%`)
  }
  if (filter.status) {
    conditions.push('status = ?')
    params.push(filter.status)
  }
  if (filter.startDate) {
    conditions.push('created_at >= ?')
    params.push(filter.startDate)
  }
  if (filter.endDate) {
    conditions.push('created_at <= ?')
    params.push(filter.endDate)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = filter.limit ?? 50
  const offset = filter.offset ?? 0

  const total = (
    getDb()
      .prepare(`SELECT COUNT(*) as count FROM tool_call_audit_log ${where}`)
      .get(...params) as { count: number }
  ).count

  const rows = getDb()
    .prepare(`SELECT * FROM tool_call_audit_log ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as AuditLogRow[]

  return { entries: rows.map(rowToAuditEntry), total }
}

export function clearAuditEntries(conversationId?: string): void {
  if (conversationId) {
    getDb().prepare('DELETE FROM tool_call_audit_log WHERE conversation_id = ?').run(conversationId)
  } else {
    getDb().prepare('DELETE FROM tool_call_audit_log').run()
  }
}
