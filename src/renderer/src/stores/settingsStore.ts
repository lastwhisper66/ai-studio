import { create } from 'zustand'
import type { SettingsSection } from '@renderer/components/settings/SettingsSidebar'

type ActiveView = 'chat' | 'settings' | 'translate'

interface SettingsState {
  settings: Record<string, string>
  isLoaded: boolean
  isSaving: boolean
  error: string | null
  activeView: ActiveView
  pendingSettingsSection: SettingsSection | null

  loadSettings: () => Promise<void>
  saveSettings: (values: Record<string, string>) => Promise<boolean>
  clearError: () => void
  setActiveView: (view: ActiveView) => void
  navigateToSettings: (section: SettingsSection) => void
  consumePendingSection: () => SettingsSection | null
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: {},
  isLoaded: false,
  isSaving: false,
  error: null,
  activeView: 'chat',
  pendingSettingsSection: null,

  clearError: () => set({ error: null }),
  setActiveView: (view: ActiveView) => set({ activeView: view }),
  navigateToSettings: (section) => set({ activeView: 'settings', pendingSettingsSection: section }),
  consumePendingSection: () => {
    const section = get().pendingSettingsSection
    if (section) set({ pendingSettingsSection: null })
    return section
  },

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
