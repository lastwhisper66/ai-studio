import { create } from 'zustand'
import type { SettingsSection } from '@renderer/components/settings/SettingsSidebar'
import type { LocalizedError } from '@shared/errors'
import { fallbackLocalizedError } from '@shared/errors'

type ActiveView = 'chat' | 'settings' | 'translate'

interface SettingsState {
  settings: Record<string, string>
  isLoaded: boolean
  isSaving: boolean
  error: LocalizedError | null
  activeView: ActiveView
  pendingSettingsSection: SettingsSection | null

  loadSettings: () => Promise<void>
  saveSettings: (values: Record<string, string>) => Promise<boolean>
  mergeExternalSettings: (values: Record<string, string>) => void
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
      set({ error: result.error ?? fallbackLocalizedError('Failed to load settings') })
    }
  },

  mergeExternalSettings: (values: Record<string, string>) => {
    // Merge settings pushed from the main process (originating in another
    // window). Skipping keys whose values already match avoids unnecessary
    // re-renders of subscribing components.
    set((state) => {
      let changed = false
      const next = { ...state.settings }
      for (const [k, v] of Object.entries(values)) {
        if (next[k] !== v) {
          next[k] = v
          changed = true
        }
      }
      return changed ? { settings: next } : state
    })
  },

  saveSettings: async (values: Record<string, string>) => {
    // Optimistic update: apply the new values to the store immediately so that
    // any derived state (e.g. targetLang) reflects the change before the async
    // IPC round-trip completes. Snapshot only the changed keys for surgical rollback.
    const current = get().settings
    const prev = Object.fromEntries(Object.keys(values).map((k) => [k, current[k]]))
    set((state) => ({
      settings: { ...state.settings, ...values },
      isSaving: true,
      error: null,
    }))
    try {
      const result = await window.api.setSettingsBatch(values)
      if (!result.success) {
        // Surgical rollback — only revert the keys this call changed
        set((state) => ({
          settings: { ...state.settings, ...prev },
          isSaving: false,
          error: result.error ?? fallbackLocalizedError('Failed to save settings'),
        }))
        return false
      }
      set({ isSaving: false })
      return true
    } catch (e) {
      // Surgical rollback — only revert the keys this call changed
      set((state) => ({
        settings: { ...state.settings, ...prev },
        isSaving: false,
        error: fallbackLocalizedError((e as Error).message),
      }))
      return false
    }
  },
}))

// Auto-subscribe to cross-window settings broadcasts at module load. Keeping
// this wiring inside the store (rather than in each window's App component)
// means every renderer that imports the store — main, quick-assistant,
// selection-bubble — stays in sync automatically, mirroring the observer
// pattern used by electron-store's `.onDidAnyChange()`. Guarded so SSR / tests
// without `window.api` don't crash.
if (typeof window !== 'undefined' && window.api?.onSettingsChanged) {
  window.api.onSettingsChanged((entries) => {
    useSettingsStore.getState().mergeExternalSettings(entries)
  })
}
