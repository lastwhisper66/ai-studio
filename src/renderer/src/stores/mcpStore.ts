import { create } from 'zustand'
import type {
  McpServer,
  McpTool,
  McpServerState,
  McpServerStatus,
  CreateMcpServerPayload,
  UpdateMcpServerPayload,
  McpResource,
  McpResourceContent,
  McpPrompt,
  McpPromptMessage,
} from '@shared/types'

interface McpStore {
  servers: McpServer[]
  tools: McpTool[]
  resources: Map<string, McpResource[]>
  prompts: Map<string, McpPrompt[]>
  statuses: Map<string, { status: McpServerStatus; error?: string }>
  isLoaded: boolean
  selectedServerId: string | null

  loadServers: () => Promise<void>
  addServer: (data: CreateMcpServerPayload) => Promise<McpServer | undefined>
  updateServer: (id: string, data: UpdateMcpServerPayload) => Promise<void>
  deleteServer: (id: string) => Promise<void>
  reorderServers: (orderedIds: string[]) => Promise<void>
  setSelectedServerId: (id: string | null) => void

  connectServer: (id: string) => Promise<void>
  disconnectServer: (id: string) => Promise<void>
  reconnectServer: (id: string) => Promise<void>
  testServer: (id: string) => Promise<{ success: boolean; error?: string }>

  loadTools: (serverId?: string) => Promise<void>
  updateTool: (id: string, data: { enabled?: boolean }) => Promise<void>

  loadResources: (serverId: string) => Promise<void>
  readResource: (serverId: string, uri: string) => Promise<McpResourceContent | undefined>
  loadPrompts: (serverId: string) => Promise<void>
  getPrompt: (
    serverId: string,
    name: string,
    args?: Record<string, string>,
  ) => Promise<McpPromptMessage[] | undefined>

  handleStatusChanged: (state: McpServerState) => void
}

export const useMcpStore = create<McpStore>((set, get) => ({
  servers: [],
  tools: [],
  resources: new Map(),
  prompts: new Map(),
  statuses: new Map(),
  isLoaded: false,
  selectedServerId: null,

  loadServers: async () => {
    const [serversResult, toolsResult] = await Promise.all([
      window.api.listMcpServers(),
      window.api.listMcpTools(),
    ])

    if (serversResult.success && serversResult.data) {
      set({
        servers: serversResult.data,
        tools: toolsResult.success && toolsResult.data ? toolsResult.data : [],
        isLoaded: true,
        selectedServerId: get().selectedServerId ?? serversResult.data[0]?.id ?? null,
      })
    }
  },

  addServer: async (data) => {
    const result = await window.api.createMcpServer(data)
    if (result.success && result.data) {
      const server = result.data
      set((state) => ({
        servers: [...state.servers, server],
        selectedServerId: server.id,
      }))
      return server
    }
    return undefined
  },

  updateServer: async (id, data) => {
    const result = await window.api.updateMcpServer(id, data)
    if (result.success && result.data) {
      const updated = result.data
      set((state) => ({
        servers: state.servers.map((s) => (s.id === id ? updated : s)),
      }))
    }
  },

  deleteServer: async (id) => {
    const result = await window.api.deleteMcpServer(id)
    if (result.success) {
      set((state) => {
        const servers = state.servers.filter((s) => s.id !== id)
        const tools = state.tools.filter((t) => t.serverId !== id)
        const wasSelected = state.selectedServerId === id
        const newStatuses = new Map(state.statuses)
        newStatuses.delete(id)
        return {
          servers,
          tools,
          statuses: newStatuses,
          selectedServerId: wasSelected ? (servers[0]?.id ?? null) : state.selectedServerId,
        }
      })
    }
  },

  reorderServers: async (orderedIds) => {
    set((state) => {
      const idToIndex = new Map(orderedIds.map((id, i) => [id, i]))
      return {
        servers: [...state.servers].sort(
          (a, b) => (idToIndex.get(a.id) ?? Infinity) - (idToIndex.get(b.id) ?? Infinity),
        ),
      }
    })
    const result = await window.api.reorderMcpServers(orderedIds)
    if (!result.success) {
      await get().loadServers()
    }
  },

  setSelectedServerId: (id) => set({ selectedServerId: id }),

  connectServer: async (id) => {
    set((state) => {
      const newStatuses = new Map(state.statuses)
      newStatuses.set(id, { status: 'connecting' })
      return { statuses: newStatuses }
    })
    await window.api.connectMcpServer(id)
  },

  disconnectServer: async (id) => {
    await window.api.disconnectMcpServer(id)
  },

  reconnectServer: async (id) => {
    set((state) => {
      const newStatuses = new Map(state.statuses)
      newStatuses.set(id, { status: 'connecting' })
      return { statuses: newStatuses }
    })
    await window.api.reconnectMcpServer(id)
  },

  testServer: async (id) => {
    const result = await window.api.testMcpServer(id)
    if (result.success && result.data) {
      return result.data
    }
    return { success: false, error: result.error?.toString() }
  },

  loadTools: async (serverId) => {
    const result = await window.api.listMcpTools(serverId)
    if (result.success && result.data) {
      if (serverId) {
        set((state) => ({
          tools: [...state.tools.filter((t) => t.serverId !== serverId), ...result.data!],
        }))
      } else {
        set({ tools: result.data })
      }
    }
  },

  updateTool: async (id, data) => {
    const result = await window.api.updateMcpTool(id, data)
    if (result.success && result.data) {
      const updated = result.data
      set((state) => ({
        tools: state.tools.map((t) => (t.id === id ? updated : t)),
      }))
    }
  },

  loadResources: async (serverId) => {
    const result = await window.api.listMcpResources(serverId)
    if (result.success && result.data) {
      set((state) => {
        const newResources = new Map(state.resources)
        newResources.set(serverId, result.data!)
        return { resources: newResources }
      })
    }
  },

  readResource: async (serverId, uri) => {
    const result = await window.api.readMcpResource(serverId, uri)
    if (result.success && result.data) {
      return result.data
    }
    return undefined
  },

  loadPrompts: async (serverId) => {
    const result = await window.api.listMcpPrompts(serverId)
    if (result.success && result.data) {
      set((state) => {
        const newPrompts = new Map(state.prompts)
        newPrompts.set(serverId, result.data!)
        return { prompts: newPrompts }
      })
    }
  },

  getPrompt: async (serverId, name, args) => {
    const result = await window.api.getMcpPrompt(serverId, name, args)
    if (result.success && result.data) {
      return result.data
    }
    return undefined
  },

  handleStatusChanged: (state) => {
    set((prev) => {
      const newStatuses = new Map(prev.statuses)
      newStatuses.set(state.serverId, {
        status: state.status,
        error: state.error,
      })
      const newTools = [...prev.tools.filter((t) => t.serverId !== state.serverId), ...state.tools]
      const newResources = new Map(prev.resources)
      if (state.resources) newResources.set(state.serverId, state.resources)
      const newPrompts = new Map(prev.prompts)
      if (state.prompts) newPrompts.set(state.serverId, state.prompts)
      return {
        statuses: newStatuses,
        tools: newTools,
        resources: newResources,
        prompts: newPrompts,
      }
    })
  },
}))
