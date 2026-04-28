import { BrowserWindow } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type {
  McpServerState,
  McpServerStatus,
  McpTool,
  McpResource,
  McpPrompt,
} from '@shared/types'
import { listMcpServers, getMcpServer } from '../db/mcp-servers'
import { upsertMcpTools, listMcpTools } from '../db/mcp-tools'
import { McpClientWrapper } from './mcp-client'
import type { UpsertMcpToolData } from '../db/mcp-tools'

export class McpManager {
  private static instance: McpManager | null = null
  private clients = new Map<string, McpClientWrapper>()
  private states = new Map<string, McpServerState>()
  private mainWindow: BrowserWindow | null = null

  private constructor() {}

  static getInstance(): McpManager {
    if (!McpManager.instance) {
      McpManager.instance = new McpManager()
    }
    return McpManager.instance
  }

  setMainWindow(win: BrowserWindow): void {
    this.mainWindow = win
  }

  async connectAllEnabled(): Promise<void> {
    const servers = listMcpServers().filter((s) => s.enabled)
    await Promise.allSettled(servers.map((s) => this.connectServer(s.id)))
  }

  async disconnectAll(): Promise<void> {
    await Promise.allSettled(Array.from(this.clients.values()).map((c) => c.disconnect()))
    this.clients.clear()
    this.states.clear()
  }

  async connectServer(serverId: string): Promise<void> {
    const server = getMcpServer(serverId)
    if (!server) return

    const existing = this.clients.get(serverId)
    if (existing) {
      await existing.disconnect()
    }

    const client = new McpClientWrapper(server, {
      onStatusChange: (status: McpServerStatus, error?: string) => {
        this.updateState(serverId, { status, error })
      },
      onToolsChanged: (tools: UpsertMcpToolData[]) => {
        const saved = upsertMcpTools(serverId, tools)
        this.updateState(serverId, { tools: saved })
      },
      onResourcesChanged: (resources: McpResource[]) => {
        this.updateState(serverId, { resources })
      },
      onPromptsChanged: (prompts: McpPrompt[]) => {
        this.updateState(serverId, { prompts })
      },
    })

    this.clients.set(serverId, client)
    this.updateState(serverId, {
      status: 'connecting',
      tools: listMcpTools(serverId),
      resources: [],
      prompts: [],
    })

    try {
      await client.connect()
    } catch {
      // status already set by client events
    }
  }

  async disconnectServer(serverId: string): Promise<void> {
    const client = this.clients.get(serverId)
    if (client) {
      await client.disconnect()
      this.clients.delete(serverId)
    }
    this.updateState(serverId, { status: 'disconnected', error: undefined })
  }

  async reconnectServer(serverId: string): Promise<void> {
    await this.disconnectServer(serverId)
    await this.connectServer(serverId)
  }

  async testServer(serverId: string): Promise<{ success: boolean; error?: string }> {
    const server = getMcpServer(serverId)
    if (!server) return { success: false, error: 'Server not found' }

    const testClient = new McpClientWrapper(server, {
      onStatusChange: () => {},
      onToolsChanged: () => {},
      onResourcesChanged: () => {},
      onPromptsChanged: () => {},
    })

    try {
      await testClient.connect()
      await testClient.refreshTools()
      await testClient.disconnect()
      return { success: true }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  async callTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<{ content: unknown[]; isError?: boolean }> {
    const client = this.clients.get(serverId)
    if (!client) {
      throw new Error(`No active connection for server ${serverId}`)
    }
    return client.callTool(toolName, args)
  }

  async listResources(serverId: string): Promise<McpResource[]> {
    const client = this.clients.get(serverId)
    if (!client) return []
    return client.refreshResources()
  }

  async readResource(
    serverId: string,
    uri: string,
  ): Promise<{ uri: string; mimeType?: string; text?: string; blob?: string }> {
    const client = this.clients.get(serverId)
    if (!client) {
      throw new Error(`No active connection for server ${serverId}`)
    }
    return client.readResource(uri)
  }

  async listPrompts(serverId: string): Promise<McpPrompt[]> {
    const client = this.clients.get(serverId)
    if (!client) return []
    return client.refreshPrompts()
  }

  async getPrompt(
    serverId: string,
    name: string,
    args?: Record<string, string>,
  ): Promise<{ messages: Array<{ role: string; content: unknown }> }> {
    const client = this.clients.get(serverId)
    if (!client) {
      throw new Error(`No active connection for server ${serverId}`)
    }
    return client.getPrompt(name, args)
  }

  getServerState(serverId: string): McpServerState {
    return (
      this.states.get(serverId) ?? {
        serverId,
        status: 'disconnected',
        tools: [],
        resources: [],
        prompts: [],
      }
    )
  }

  getAllStates(): McpServerState[] {
    return Array.from(this.states.values())
  }

  getEnabledTools(): { serverId: string; tool: McpTool }[] {
    const result: { serverId: string; tool: McpTool }[] = []
    for (const [serverId, client] of this.clients) {
      if (client.status !== 'connected') continue
      const state = this.states.get(serverId)
      if (!state) continue
      for (const tool of state.tools) {
        if (tool.enabled) {
          result.push({ serverId, tool })
        }
      }
    }
    return result
  }

  private updateState(serverId: string, partial: Partial<Omit<McpServerState, 'serverId'>>): void {
    const current = this.states.get(serverId) ?? {
      serverId,
      status: 'disconnected' as McpServerStatus,
      tools: [],
      resources: [],
      prompts: [],
    }
    const updated = { ...current, ...partial }
    this.states.set(serverId, updated)
    this.pushStatusToRenderer(updated)
  }

  private pushStatusToRenderer(state: McpServerState): void {
    this.mainWindow?.webContents.send(IpcChannels.MCP_SERVER_STATUS_CHANGED, state)
  }
}
