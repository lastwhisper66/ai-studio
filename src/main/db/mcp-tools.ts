import { randomUUID } from 'crypto'
import type { McpTool } from '@shared/types'
import { getDb } from './database'

interface McpToolRow {
  id: string
  server_id: string
  name: string
  description: string
  input_schema: string
  enabled: number
}

function rowToMcpTool(row: McpToolRow): McpTool {
  return {
    id: row.id,
    serverId: row.server_id,
    name: row.name,
    description: row.description,
    inputSchema: JSON.parse(row.input_schema) as Record<string, unknown>,
    enabled: row.enabled === 1,
  }
}

export function listMcpTools(serverId?: string): McpTool[] {
  if (serverId) {
    const rows = getDb()
      .prepare('SELECT * FROM mcp_tools WHERE server_id = ? ORDER BY name ASC')
      .all(serverId) as McpToolRow[]
    return rows.map(rowToMcpTool)
  }
  const rows = getDb().prepare('SELECT * FROM mcp_tools ORDER BY name ASC').all() as McpToolRow[]
  return rows.map(rowToMcpTool)
}

export function getMcpTool(id: string): McpTool | undefined {
  const row = getDb().prepare('SELECT * FROM mcp_tools WHERE id = ?').get(id) as
    | McpToolRow
    | undefined
  if (!row) return undefined
  return rowToMcpTool(row)
}

export function updateMcpTool(id: string, data: { enabled?: boolean }): McpTool | undefined {
  if (data.enabled !== undefined) {
    getDb()
      .prepare('UPDATE mcp_tools SET enabled = ? WHERE id = ?')
      .run(data.enabled ? 1 : 0, id)
  }
  return getMcpTool(id)
}

export interface UpsertMcpToolData {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export function upsertMcpTools(serverId: string, tools: UpsertMcpToolData[]): McpTool[] {
  const db = getDb()
  const existing = db
    .prepare('SELECT id, name, enabled FROM mcp_tools WHERE server_id = ?')
    .all(serverId) as { id: string; name: string; enabled: number }[]

  const existingByName = new Map(existing.map((r) => [r.name, r]))
  const incomingNames = new Set(tools.map((t) => t.name))

  db.transaction(() => {
    for (const row of existing) {
      if (!incomingNames.has(row.name)) {
        db.prepare('DELETE FROM mcp_tools WHERE id = ?').run(row.id)
      }
    }

    for (const tool of tools) {
      const prev = existingByName.get(tool.name)
      if (prev) {
        db.prepare('UPDATE mcp_tools SET description = ?, input_schema = ? WHERE id = ?').run(
          tool.description,
          JSON.stringify(tool.inputSchema),
          prev.id,
        )
      } else {
        db.prepare(
          `INSERT INTO mcp_tools (id, server_id, name, description, input_schema, enabled)
           VALUES (?, ?, ?, ?, ?, 1)`,
        ).run(randomUUID(), serverId, tool.name, tool.description, JSON.stringify(tool.inputSchema))
      }
    }
  })()

  return listMcpTools(serverId)
}

export function deleteMcpToolsByServer(serverId: string): void {
  getDb().prepare('DELETE FROM mcp_tools WHERE server_id = ?').run(serverId)
}
