import { create } from 'zustand'
import type { ModelDefinition, ModelCapability } from '@shared/types'

interface ModelDefinitionStore {
  definitions: ModelDefinition[]
  isLoaded: boolean

  load: () => Promise<void>
  add: (data: {
    name: string
    group?: string
    capabilities?: ModelCapability[]
    contextWindow?: number | null
  }) => Promise<ModelDefinition | undefined>
  update: (
    id: string,
    data: {
      name?: string
      group?: string
      capabilities?: ModelCapability[]
      contextWindow?: number | null
    },
  ) => Promise<void>
  remove: (id: string) => Promise<void>
  /** Synchronous lookup from local state (no IPC round-trip) */
  lookup: (name: string) => ModelDefinition | undefined
  /**
   * Three-level fuzzy resolve (mirrors DB-side resolveModelDefinition):
   *   1. Exact match
   *   2. Prefix match (name starts with def.name + '-') → longest wins
   *   3. Contains match (name includes def.name) → longest wins
   */
  resolve: (name: string) => ModelDefinition | undefined
}

export const useModelDefinitionStore = create<ModelDefinitionStore>((set, get) => ({
  definitions: [],
  isLoaded: false,

  load: async () => {
    const result = await window.api.listModelDefinitions()
    if (result.success && result.data) {
      set({ definitions: result.data, isLoaded: true })
    }
  },

  add: async (data) => {
    const result = await window.api.createModelDefinition(data)
    if (result.success && result.data) {
      set((s) => ({ definitions: [...s.definitions, result.data!] }))
      return result.data
    }
    return undefined
  },

  update: async (id, data) => {
    const result = await window.api.updateModelDefinition(id, data)
    if (result.success && result.data) {
      set((s) => ({
        definitions: s.definitions.map((d) => (d.id === id ? result.data! : d)),
      }))
    }
  },

  remove: async (id) => {
    const result = await window.api.deleteModelDefinition(id)
    if (result.success) {
      set((s) => ({ definitions: s.definitions.filter((d) => d.id !== id) }))
    }
  },

  lookup: (name) => {
    return get().definitions.find((d) => d.name === name)
  },

  resolve: (name) => {
    const lower = name.toLowerCase()
    const defs = get().definitions
    // Level 1: exact (case-insensitive)
    const exact = defs.find((d) => d.name.toLowerCase() === lower)
    if (exact) return exact
    // Level 2: prefix — name starts with def.name + '-'
    const prefixCandidates = defs.filter((d) => lower.startsWith(d.name.toLowerCase() + '-'))
    if (prefixCandidates.length > 0) {
      return prefixCandidates.reduce((best, cur) =>
        cur.name.length > best.name.length ? cur : best,
      )
    }
    // Level 3: contains with word boundary — name includes def.name at a separator boundary
    const SEP = /[-_/.:]/
    const containsCandidates = defs.filter((d) => {
      if (d.name.length < 2) return false
      const dn = d.name.toLowerCase()
      const idx = lower.indexOf(dn)
      if (idx < 0) return false
      const before = idx === 0 || SEP.test(lower[idx - 1])
      const afterIdx = idx + dn.length
      const after = afterIdx >= lower.length || SEP.test(lower[afterIdx])
      return before && after
    })
    if (containsCandidates.length > 0) {
      return containsCandidates.reduce((best, cur) =>
        cur.name.length > best.name.length ? cur : best,
      )
    }
    return undefined
  },
}))
