import { create } from 'zustand'
import type { QuickAction } from '@shared/types'

interface QuickActionState {
  actions: QuickAction[]
  isLoaded: boolean

  loadActions: () => Promise<void>
  createAction: (data: {
    name: string
    description?: string
    systemPrompt?: string
    icon?: string
  }) => Promise<QuickAction | null>
  updateAction: (
    id: string,
    data: Partial<Pick<QuickAction, 'name' | 'description' | 'systemPrompt' | 'icon' | 'enabled'>>,
  ) => Promise<void>
  deleteAction: (id: string) => Promise<void>
  reorderActions: (ids: string[]) => Promise<void>
}

export const useQuickActionStore = create<QuickActionState>((set) => ({
  actions: [],
  isLoaded: false,

  loadActions: async () => {
    const result = await window.api.listQuickActions()
    if (result.success && result.data) {
      set({ actions: result.data, isLoaded: true })
    }
  },

  createAction: async (data) => {
    const result = await window.api.createQuickAction(data)
    if (result.success && result.data) {
      set((state) => ({ actions: [...state.actions, result.data!] }))
      return result.data
    }
    return null
  },

  updateAction: async (id, data) => {
    const result = await window.api.updateQuickAction(id, data)
    if (result.success && result.data) {
      const updated = result.data
      set((state) => ({
        actions: state.actions.map((a) => (a.id === id ? updated : a)),
      }))
    }
  },

  deleteAction: async (id) => {
    const result = await window.api.deleteQuickAction(id)
    if (result.success) {
      set((state) => ({
        actions: state.actions.filter((a) => a.id !== id),
      }))
    }
  },

  reorderActions: async (ids) => {
    // Optimistic reorder
    set((state) => {
      const map = new Map(state.actions.map((a) => [a.id, a]))
      const reordered = ids.map((id, i) => ({ ...map.get(id)!, sortOrder: i }))
      const remaining = state.actions
        .filter((a) => !ids.includes(a.id))
        .map((a, i) => ({ ...a, sortOrder: ids.length + i }))
      return { actions: [...reordered, ...remaining] }
    })
    await window.api.reorderQuickActions(ids)
  },
}))
