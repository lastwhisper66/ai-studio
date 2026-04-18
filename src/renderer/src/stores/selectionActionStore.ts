import { create } from 'zustand'
import type { SelectionAction } from '@shared/types'

interface SelectionActionState {
  actions: SelectionAction[]
  isLoaded: boolean

  loadActions: () => Promise<void>
  createAction: (data: {
    name: string
    description?: string
    systemPrompt?: string
    icon?: string
  }) => Promise<SelectionAction | null>
  updateAction: (
    id: string,
    data: Partial<
      Pick<SelectionAction, 'name' | 'description' | 'systemPrompt' | 'icon' | 'enabled'>
    >,
  ) => Promise<void>
  deleteAction: (id: string) => Promise<void>
  reorderActions: (ids: string[]) => Promise<void>
}

export const useSelectionActionStore = create<SelectionActionState>((set) => ({
  actions: [],
  isLoaded: false,

  loadActions: async () => {
    const result = await window.api.listSelectionActions()
    if (result.success && result.data) {
      set({ actions: result.data, isLoaded: true })
    } else {
      console.error('[selectionActionStore] loadActions failed:', result.error)
    }
  },

  createAction: async (data) => {
    const result = await window.api.createSelectionAction(data)
    if (result.success && result.data) {
      set((state) => ({ actions: [...state.actions, result.data!] }))
      return result.data
    }
    return null
  },

  updateAction: async (id, data) => {
    const result = await window.api.updateSelectionAction(id, data)
    if (result.success && result.data) {
      const updated = result.data
      set((state) => ({
        actions: state.actions.map((a) => (a.id === id ? updated : a)),
      }))
    }
  },

  deleteAction: async (id) => {
    const result = await window.api.deleteSelectionAction(id)
    if (result.success) {
      set((state) => ({
        actions: state.actions.filter((a) => a.id !== id),
      }))
    }
  },

  reorderActions: async (ids) => {
    let previous: SelectionAction[] = []
    set((state) => {
      previous = state.actions
      const map = new Map(state.actions.map((a) => [a.id, a]))
      const reordered = ids.map((id, i) => ({ ...map.get(id)!, sortOrder: i }))
      const remaining = state.actions
        .filter((a) => !ids.includes(a.id))
        .map((a, i) => ({ ...a, sortOrder: ids.length + i }))
      return { actions: [...reordered, ...remaining] }
    })
    const result = await window.api.reorderSelectionActions(ids)
    if (!result.success) {
      console.error('[selectionActionStore] reorderActions failed, rolling back:', result.error)
      set({ actions: previous })
    }
  },
}))
