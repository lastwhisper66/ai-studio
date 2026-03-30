import { create } from 'zustand'
import type { ModelDefinition, ModelCapability, ProviderType } from '@shared/types'

interface ModelDefinitionStore {
  definitions: ModelDefinition[]
  isLoaded: boolean

  load: () => Promise<void>
  add: (data: {
    name: string
    group?: string
    capabilities?: ModelCapability[]
    providerTypes?: ProviderType[]
  }) => Promise<ModelDefinition | undefined>
  update: (
    id: string,
    data: {
      name?: string
      group?: string
      capabilities?: ModelCapability[]
      providerTypes?: ProviderType[]
    },
  ) => Promise<void>
  remove: (id: string) => Promise<void>
  /** Synchronous lookup from local state (no IPC round-trip) */
  lookup: (name: string) => ModelDefinition | undefined
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
}))
