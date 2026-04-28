import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type {
  IpcResult,
  McpServer,
  McpTool,
  McpServerState,
  McpResource,
  McpResourceContent,
  McpPrompt,
  McpPromptMessage,
} from '@shared/types'
import { toLocalizedError } from '../errors'
import {
  listMcpServers,
  getMcpServer,
  createMcpServer,
  updateMcpServer,
  deleteMcpServer,
  reorderMcpServers,
  listMcpTools,
  updateMcpTool,
} from '../db'
import type { CreateMcpServerData, UpdateMcpServerData } from '../db/mcp-servers'
import { McpManager } from '../mcp/mcp-manager'

export function registerMcpHandlers(): void {
  ipcMain.handle(IpcChannels.MCP_SERVER_LIST, (): IpcResult<McpServer[]> => {
    try {
      const data = listMcpServers()
      return { success: true, data }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(IpcChannels.MCP_SERVER_GET, (_, id: string): IpcResult<McpServer | undefined> => {
    try {
      const data = getMcpServer(id)
      return { success: true, data }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(
    IpcChannels.MCP_SERVER_CREATE,
    (_, data: CreateMcpServerData): IpcResult<McpServer> => {
      try {
        const server = createMcpServer(data)
        return { success: true, data: server }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(
    IpcChannels.MCP_SERVER_UPDATE,
    (_, id: string, data: UpdateMcpServerData): IpcResult<McpServer | undefined> => {
      try {
        const server = updateMcpServer(id, data)
        return { success: true, data: server }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(IpcChannels.MCP_SERVER_DELETE, async (_, id: string): Promise<IpcResult<void>> => {
    try {
      await McpManager.getInstance().disconnectServer(id)
      deleteMcpServer(id)
      return { success: true }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(IpcChannels.MCP_SERVER_REORDER, (_, ids: string[]): IpcResult<void> => {
    try {
      reorderMcpServers(ids)
      return { success: true }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(
    IpcChannels.MCP_SERVER_CONNECT,
    async (_, id: string): Promise<IpcResult<McpServerState>> => {
      try {
        await McpManager.getInstance().connectServer(id)
        const state = McpManager.getInstance().getServerState(id)
        return { success: true, data: state }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(
    IpcChannels.MCP_SERVER_DISCONNECT,
    async (_, id: string): Promise<IpcResult<void>> => {
      try {
        await McpManager.getInstance().disconnectServer(id)
        return { success: true }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(
    IpcChannels.MCP_SERVER_RECONNECT,
    async (_, id: string): Promise<IpcResult<McpServerState>> => {
      try {
        await McpManager.getInstance().reconnectServer(id)
        const state = McpManager.getInstance().getServerState(id)
        return { success: true, data: state }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(
    IpcChannels.MCP_SERVER_TEST,
    async (_, id: string): Promise<IpcResult<{ success: boolean; error?: string }>> => {
      try {
        const result = await McpManager.getInstance().testServer(id)
        return { success: true, data: result }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(IpcChannels.MCP_TOOL_LIST, (_, serverId?: string): IpcResult<McpTool[]> => {
    try {
      const data = listMcpTools(serverId)
      return { success: true, data }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(
    IpcChannels.MCP_TOOL_UPDATE,
    (_, id: string, data: { enabled?: boolean }): IpcResult<McpTool | undefined> => {
      try {
        const tool = updateMcpTool(id, data)
        return { success: true, data: tool }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  // MCP Resources
  ipcMain.handle(
    IpcChannels.MCP_RESOURCE_LIST,
    async (_, serverId: string): Promise<IpcResult<McpResource[]>> => {
      try {
        const data = await McpManager.getInstance().listResources(serverId)
        return { success: true, data }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(
    IpcChannels.MCP_RESOURCE_READ,
    async (_, serverId: string, uri: string): Promise<IpcResult<McpResourceContent>> => {
      try {
        const data = await McpManager.getInstance().readResource(serverId, uri)
        return { success: true, data }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  // MCP Prompts
  ipcMain.handle(
    IpcChannels.MCP_PROMPT_LIST,
    async (_, serverId: string): Promise<IpcResult<McpPrompt[]>> => {
      try {
        const data = await McpManager.getInstance().listPrompts(serverId)
        return { success: true, data }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(
    IpcChannels.MCP_PROMPT_GET,
    async (
      _,
      serverId: string,
      name: string,
      args?: Record<string, string>,
    ): Promise<IpcResult<McpPromptMessage[]>> => {
      try {
        const result = await McpManager.getInstance().getPrompt(serverId, name, args)
        const messages: McpPromptMessage[] = result.messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content as McpPromptMessage['content'],
        }))
        return { success: true, data: messages }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )
}
