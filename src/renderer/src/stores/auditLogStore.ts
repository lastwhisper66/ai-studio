import { create } from 'zustand'
import type { ToolCallAuditEntry, ToolCallAuditFilter } from '@shared/types'

interface AuditLogStore {
  entries: ToolCallAuditEntry[]
  total: number
  filter: ToolCallAuditFilter
  isLoaded: boolean
  expandedEntryId: string | null

  loadEntries: () => Promise<void>
  setFilter: (filter: Partial<ToolCallAuditFilter>) => void
  clearLog: (conversationId?: string) => Promise<void>
  setExpandedEntryId: (id: string | null) => void
}

export const useAuditLogStore = create<AuditLogStore>((set, get) => ({
  entries: [],
  total: 0,
  filter: { limit: 50, offset: 0 },
  isLoaded: false,
  expandedEntryId: null,

  loadEntries: async () => {
    const result = await window.api.listAuditEntries(get().filter)
    if (result.success && result.data) {
      set({
        entries: result.data.entries,
        total: result.data.total,
        isLoaded: true,
      })
    }
  },

  setFilter: (partial) => {
    const current = get().filter
    set({ filter: { ...current, ...partial } })
    get().loadEntries()
  },

  clearLog: async (conversationId) => {
    const result = await window.api.clearAuditEntries(conversationId)
    if (result.success) {
      get().loadEntries()
    }
  },

  setExpandedEntryId: (id) => set({ expandedEntryId: id }),
}))
