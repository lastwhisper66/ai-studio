import { create } from 'zustand'
import type {
  Provider,
  CreateProviderPayload,
  UpdateProviderPayload,
  Model,
  ModelCapability,
} from '@shared/types'

interface ProviderStore {
  providers: Provider[]
  models: Model[]
  activeProviderId: string | null
  activeModelId: string | null
  isLoaded: boolean
  selectedProviderId: string | null

  loadProviders: () => Promise<void>
  addProvider: (data: CreateProviderPayload) => Promise<Provider | undefined>
  updateProvider: (id: string, data: UpdateProviderPayload) => Promise<void>
  deleteProvider: (id: string) => Promise<void>
  reorderProviders: (orderedIds: string[]) => Promise<void>
  setActiveProvider: (id: string) => Promise<void>
  setSelectedProviderId: (id: string | null) => void

  // Model operations
  addModel: (
    providerId: string,
    name: string,
    group?: string,
    capabilities?: ModelCapability[],
  ) => Promise<Model | undefined>
  updateModel: (
    id: string,
    data: { name?: string; group?: string; capabilities?: ModelCapability[] },
  ) => Promise<void>
  removeModel: (id: string) => Promise<void>
  removeAllModels: (providerId: string) => Promise<void>
  reorderModels: (orderedIds: string[]) => Promise<void>
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
      const modelsResult = await window.api.listModels()
      set((state) => ({
        providers: [...state.providers, provider],
        models: modelsResult.success && modelsResult.data ? modelsResult.data : state.models,
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

  reorderProviders: async (orderedIds) => {
    set((state) => {
      const idToIndex = new Map(orderedIds.map((id, i) => [id, i]))
      return {
        providers: [...state.providers].sort(
          (a, b) => (idToIndex.get(a.id) ?? Infinity) - (idToIndex.get(b.id) ?? Infinity),
        ),
      }
    })
    const result = await window.api.reorderProviders(orderedIds)
    if (!result.success) {
      await get().loadProviders()
    }
  },

  addModel: async (providerId, name, group, capabilities) => {
    const result = await window.api.createModel({ providerId, name, group, capabilities })
    if (result.success && result.data) {
      const model = result.data
      set((state) => ({ models: [...state.models, model] }))
      return model
    }
    return undefined
  },

  updateModel: async (id, data) => {
    const result = await window.api.updateModel(id, data)
    if (result.success && result.data) {
      const updated = result.data
      set((state) => ({
        models: state.models.map((m) => (m.id === id ? updated : m)),
      }))
    }
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

  removeAllModels: async (providerId) => {
    const result = await window.api.deleteModelsByProvider(providerId)
    if (result.success) {
      let activeWasRemoved = false
      set((state) => {
        const removedIds = new Set(
          state.models.filter((m) => m.providerId === providerId).map((m) => m.id),
        )
        activeWasRemoved = !!state.activeModelId && removedIds.has(state.activeModelId)
        const models = state.models.filter((m) => m.providerId !== providerId)
        return { models, activeModelId: activeWasRemoved ? null : state.activeModelId }
      })
      if (activeWasRemoved) {
        await window.api.setSetting('active.modelId', '')
      }
    }
  },

  setActiveModel: async (modelId, providerId) => {
    await Promise.all([
      window.api.setSetting('active.providerId', providerId),
      window.api.setSetting('active.modelId', modelId),
    ])
    set({ activeProviderId: providerId, activeModelId: modelId })
  },

  reorderModels: async (orderedIds) => {
    set((state) => {
      const idToIndex = new Map(orderedIds.map((id, i) => [id, i]))
      return {
        models: [...state.models].sort((a, b) => {
          const ai = idToIndex.get(a.id)
          const bi = idToIndex.get(b.id)
          if (ai !== undefined && bi !== undefined) return ai - bi
          if (ai !== undefined) return -1
          if (bi !== undefined) return 1
          return 0
        }),
      }
    })
    const result = await window.api.reorderModels(orderedIds)
    if (!result.success) {
      const modelsResult = await window.api.listModels()
      if (modelsResult.success && modelsResult.data) {
        set({ models: modelsResult.data })
      }
    }
  },
}))
