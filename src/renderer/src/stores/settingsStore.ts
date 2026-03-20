import { create } from 'zustand'

type ActiveView = 'chat' | 'settings' | 'translate'

interface SettingsState {
  settings: Record<string, string>
  isLoaded: boolean
  isSaving: boolean
  error: string | null
  activeView: ActiveView

  loadSettings: () => Promise<void>
  saveSettings: (values: Record<string, string>) => Promise<boolean>
  clearError: () => void
  setActiveView: (view: ActiveView) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: {},
  isLoaded: false,
  isSaving: false,
  error: null,
  activeView: 'chat',

  clearError: () => set({ error: null }),
  setActiveView: (view: ActiveView) => set({ activeView: view }),

  loadSettings: async () => {
    const result = await window.api.getAllSettings()
    if (result.success && result.data) {
      set({ settings: result.data, isLoaded: true })
    } else {
      set({ error: result.error ?? 'Failed to load settings' })
    }
  },

  saveSettings: async (values: Record<string, string>) => {
    set({ isSaving: true, error: null })
    try {
      const result = await window.api.setSettingsBatch(values)
      if (!result.success) {
        set({ isSaving: false, error: result.error ?? 'Failed to save settings' })
        return false
      }
      set((state) => ({
        settings: { ...state.settings, ...values },
        isSaving: false,
      }))
      return true
    } catch (e) {
      set({ isSaving: false, error: (e as Error).message })
      return false
    }
  },
}))
