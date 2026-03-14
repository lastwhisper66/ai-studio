import { create } from 'zustand'
import type { Provider } from '@shared/types'

interface ProviderStore {
  providers: Provider[]
  activeProviderId: string | null
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
}

export const useProviderStore = create<ProviderStore>((set, get) => ({
  providers: [],
  activeProviderId: null,
  isLoaded: false,
  selectedProviderId: null,

  loadProviders: async () => {
    const [providersResult, activeResult] = await Promise.all([
      window.api.listProviders(),
      window.api.getSetting('active.providerId'),
    ])

    if (providersResult.success && providersResult.data) {
      const providers = providersResult.data
      const activeProviderId = activeResult.data ?? null
      set({
        providers,
        activeProviderId,
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
        const wasActive = state.activeProviderId === id
        const wasSelected = state.selectedProviderId === id
        return {
          providers,
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
}))
