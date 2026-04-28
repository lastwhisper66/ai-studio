import { randomUUID } from 'crypto'
import type { McpServer, McpServerType } from '@shared/types'
import { getDb } from './database'

interface McpServerRow {
  id: string
  name: string
  type: string
  command: string
  args: string
  env: string
  url: string
  headers: string
  enabled: number
  auto_approve: number
  sort_order: number
  created_at: string
  updated_at: string
}

function rowToMcpServer(row: McpServerRow): McpServer {
  return {
    id: row.id,
    name: row.name,
    type: row.type as McpServerType,
    command: row.command,
    args: JSON.parse(row.args) as string[],
    env: JSON.parse(row.env) as Record<string, string>,
    url: row.url,
    headers: JSON.parse(row.headers) as Record<string, string>,
    enabled: row.enabled === 1,
    autoApprove: row.auto_approve === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function listMcpServers(): McpServer[] {
  const rows = getDb()
    .prepare('SELECT * FROM mcp_servers ORDER BY sort_order ASC, created_at ASC')
    .all() as McpServerRow[]
  return rows.map(rowToMcpServer)
}

export function getMcpServer(id: string): McpServer | undefined {
  const row = getDb().prepare('SELECT * FROM mcp_servers WHERE id = ?').get(id) as
    | McpServerRow
    | undefined
  if (!row) return undefined
  return rowToMcpServer(row)
}

export interface CreateMcpServerData {
  name: string
  type: McpServerType
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
  enabled?: boolean
  autoApprove?: boolean
  sortOrder?: number
}

export function createMcpServer(data: CreateMcpServerData): McpServer {
  const id = randomUUID()
  getDb()
    .prepare(
      `INSERT INTO mcp_servers (id, name, type, command, args, env, url, headers, enabled, auto_approve, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      data.name,
      data.type,
      data.command ?? '',
      JSON.stringify(data.args ?? []),
      JSON.stringify(data.env ?? {}),
      data.url ?? '',
      JSON.stringify(data.headers ?? {}),
      data.enabled !== false ? 1 : 0,
      data.autoApprove ? 1 : 0,
      data.sortOrder ?? 0,
    )
  return getMcpServer(id)!
}

export interface UpdateMcpServerData {
  name?: string
  type?: McpServerType
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
  enabled?: boolean
  autoApprove?: boolean
  sortOrder?: number
}

export function updateMcpServer(id: string, data: UpdateMcpServerData): McpServer | undefined {
  const fields: string[] = []
  const values: unknown[] = []

  if (data.name !== undefined) {
    fields.push('name = ?')
    values.push(data.name)
  }
  if (data.type !== undefined) {
    fields.push('type = ?')
    values.push(data.type)
  }
  if (data.command !== undefined) {
    fields.push('command = ?')
    values.push(data.command)
  }
  if (data.args !== undefined) {
    fields.push('args = ?')
    values.push(JSON.stringify(data.args))
  }
  if (data.env !== undefined) {
    fields.push('env = ?')
    values.push(JSON.stringify(data.env))
  }
  if (data.url !== undefined) {
    fields.push('url = ?')
    values.push(data.url)
  }
  if (data.headers !== undefined) {
    fields.push('headers = ?')
    values.push(JSON.stringify(data.headers))
  }
  if (data.enabled !== undefined) {
    fields.push('enabled = ?')
    values.push(data.enabled ? 1 : 0)
  }
  if (data.autoApprove !== undefined) {
    fields.push('auto_approve = ?')
    values.push(data.autoApprove ? 1 : 0)
  }
  if (data.sortOrder !== undefined) {
    fields.push('sort_order = ?')
    values.push(data.sortOrder)
  }

  if (fields.length === 0) return getMcpServer(id)

  fields.push("updated_at = datetime('now')")
  values.push(id)

  getDb()
    .prepare(`UPDATE mcp_servers SET ${fields.join(', ')} WHERE id = ?`)
    .run(...values)

  return getMcpServer(id)
}

export function deleteMcpServer(id: string): void {
  getDb().prepare('DELETE FROM mcp_servers WHERE id = ?').run(id)
}

export function reorderMcpServers(ids: string[]): void {
  const db = getDb()
  const update = db.prepare('UPDATE mcp_servers SET sort_order = ? WHERE id = ?')
  db.transaction(() => {
    ids.forEach((id, index) => update.run(index, id))
  })()
}
