import { create } from 'zustand'
import type { Provider, Model } from '@shared/types'

interface ProviderStore {
  providers: Provider[]
  models: Model[]
  activeProviderId: string | null
  activeModelId: string | null
  isLoaded: boolean
  selectedProviderId: string | null

  loadProviders: () => Promise<void>
  addProvider: (
    data: Partial<Provider> & { type: Provider['type']; name: string },
  ) => Promise<Provider | undefined>
  updateProvider: (id: string, data: Partial<Provider>) => Promise<void>
  deleteProvider: (id: string) => Promise<void>
  setActiveProvider: (id: string) => Promise<void>
  setSelectedProviderId: (id: string | null) => void

  // Model operations
  addModel: (providerId: string, name: string) => Promise<Model | undefined>
  removeModel: (id: string) => Promise<void>
  setActiveModel: (modelId: string, providerId: string) => Promise<void>
}

export const useProviderStore = create<ProviderStore>((set, get) => ({
  providers: [],
  models: [],
  activeProviderId: null,
  activeModelId: null,
  isLoaded: false,
  selectedProviderId: null,

  loadProviders: async () => {
    const [providersResult, modelsResult, activeProviderResult, activeModelResult] =
      await Promise.all([
        window.api.listProviders(),
        window.api.listModels(),
        window.api.getSetting('active.providerId'),
        window.api.getSetting('active.modelId'),
      ])

    if (providersResult.success && providersResult.data) {
      const providers = providersResult.data
      const models = modelsResult.success && modelsResult.data ? modelsResult.data : []
      const activeProviderId = activeProviderResult.data ?? null
      const activeModelId = activeModelResult.data ?? null
      set({
        providers,
        models,
        activeProviderId,
        activeModelId,
        isLoaded: true,
        selectedProviderId: get().selectedProviderId ?? providers[0]?.id ?? null,
      })
    }
  },

  addProvider: async (data) => {
    const result = await window.api.createProvider(data)
    if (result.success && result.data) {
      const provider = result.data
      set((state) => ({
        providers: [...state.providers, provider],
        selectedProviderId: provider.id,
      }))
      // If this is the first provider, set it as active
      if (get().providers.length === 1) {
        await get().setActiveProvider(provider.id)
      }
      return provider
    }
    return undefined
  },

  updateProvider: async (id, data) => {
    const result = await window.api.updateProvider(id, data)
    if (result.success && result.data) {
      const updated = result.data
      set((state) => ({
        providers: state.providers.map((p) => (p.id === id ? updated : p)),
      }))
    }
  },

  deleteProvider: async (id) => {
    const result = await window.api.deleteProvider(id)
    if (result.success) {
      set((state) => {
        const providers = state.providers.filter((p) => p.id !== id)
        const models = state.models.filter((m) => m.providerId !== id)
        const wasActive = state.activeProviderId === id
        const wasSelected = state.selectedProviderId === id
        return {
          providers,
          models,
          activeProviderId: wasActive ? (providers[0]?.id ?? null) : state.activeProviderId,
          selectedProviderId: wasSelected ? (providers[0]?.id ?? null) : state.selectedProviderId,
        }
      })
      // If deleted the active provider, update settings
      if (get().activeProviderId !== id) return
      const newActiveId = get().providers[0]?.id ?? ''
      await window.api.setSetting('active.providerId', newActiveId)
    }
  },

  setActiveProvider: async (id) => {
    await window.api.setSetting('active.providerId', id)
    set({ activeProviderId: id })
  },

  setSelectedProviderId: (id) => set({ selectedProviderId: id }),

  addModel: async (providerId, name) => {
    const result = await window.api.createModel({ providerId, name })
    if (result.success && result.data) {
      const model = result.data
      set((state) => ({ models: [...state.models, model] }))
      return model
    }
    return undefined
  },

  removeModel: async (id) => {
    const result = await window.api.deleteModel(id)
    if (result.success) {
      set((state) => {
        const models = state.models.filter((m) => m.id !== id)
        // If the deleted model was the active model, clear it
        const activeModelId = state.activeModelId === id ? null : state.activeModelId
        return { models, activeModelId }
      })
    }
  },

  setActiveModel: async (modelId, providerId) => {
    await Promise.all([
      window.api.setSetting('active.providerId', providerId),
      window.api.setSetting('active.modelId', modelId),
    ])
    set({ activeProviderId: providerId, activeModelId: modelId })
  },
}))
