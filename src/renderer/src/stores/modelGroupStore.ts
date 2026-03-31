import { create } from 'zustand'
import type { ModelGroup } from '@shared/types'
import { inferModelGroup } from '@renderer/lib/inferModelGroup'

interface ModelGroupStore {
  groups: ModelGroup[]
  load: () => Promise<void>
  add: (data: { pattern: string; displayName: string; sortOrder?: number }) => Promise<void>
  update: (
    id: string,
    data: { pattern?: string; displayName?: string; sortOrder?: number },
  ) => Promise<void>
  remove: (id: string) => Promise<void>
  /**
   * Resolve a display group name for a model ID.
   * Two-level matching: exact → longest prefix.
   * Falls back to inferModelGroup() for unmatched models.
   */
  resolve: (modelId: string) => string
}

export const useModelGroupStore = create<ModelGroupStore>((set, get) => ({
  groups: [],

  load: async () => {
    const result = await window.api.listModelGroups()
    if (result.success && result.data) {
      set({ groups: result.data })
    }
  },

  add: async (data) => {
    const result = await window.api.createModelGroup(data)
    if (result.success && result.data) {
      set((s) => ({ groups: [...s.groups, result.data!] }))
    }
  },

  update: async (id, data) => {
    const result = await window.api.updateModelGroup(id, data)
    if (result.success && result.data) {
      set((s) => ({
        groups: s.groups.map((g) => (g.id === id ? result.data! : g)),
      }))
    }
  },

  remove: async (id) => {
    const result = await window.api.deleteModelGroup(id)
    if (result.success) {
      set((s) => ({ groups: s.groups.filter((g) => g.id !== id) }))
    }
  },

  resolve: (modelId: string): string => {
    const { groups } = get()
    const lower = modelId.toLowerCase()

    // Level 1: exact match
    const exact = groups.find((g) => g.pattern.toLowerCase() === lower)
    if (exact) return exact.displayName

    // Level 2: prefix match — longest pattern wins
    let best: ModelGroup | undefined
    for (const g of groups) {
      if (lower.startsWith(g.pattern.toLowerCase())) {
        if (!best || g.pattern.length > best.pattern.length) {
          best = g
        }
      }
    }
    if (best) return best.displayName

    // Fallback: infer from model ID
    return inferModelGroup(modelId)
  },
}))
