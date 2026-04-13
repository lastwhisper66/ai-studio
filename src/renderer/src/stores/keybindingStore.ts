import { create } from 'zustand'
import { DEFAULT_KEYBINDINGS, type KeybindingActionId } from '@shared/keybindings'
import { useSettingsStore } from './settingsStore'

const STORAGE_KEY = 'app.keybindings'

type Overrides = Partial<Record<KeybindingActionId, string>>

interface KeybindingState {
  overrides: Overrides
  isLoaded: boolean

  init: () => void
  getAccelerator: (actionId: KeybindingActionId) => string
  getAllEffective: () => Record<KeybindingActionId, string>
  setOverride: (actionId: KeybindingActionId, accelerator: string) => Promise<void>
  removeOverride: (actionId: KeybindingActionId) => Promise<void>
  resetAction: (actionId: KeybindingActionId) => Promise<void>
  resetAll: () => Promise<void>
}

function parseOverrides(raw: string | undefined): Overrides {
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Overrides
  } catch {
    return {}
  }
}

async function persistOverrides(overrides: Overrides): Promise<void> {
  const clean = Object.fromEntries(Object.entries(overrides).filter(([, v]) => v !== undefined))
  await useSettingsStore.getState().saveSettings({ [STORAGE_KEY]: JSON.stringify(clean) })
}

/** Notify main process to re-register the quick-assistant global shortcut */
async function syncQuickAssistantShortcut(): Promise<void> {
  try {
    await window.api.updateQuickAssistantShortcut()
  } catch {
    // non-critical
  }
}

export const useKeybindingStore = create<KeybindingState>((set, get) => ({
  overrides: {},
  isLoaded: false,

  init: () => {
    const raw = useSettingsStore.getState().settings[STORAGE_KEY]
    set({ overrides: parseOverrides(raw), isLoaded: true })
  },

  getAccelerator: (actionId) => {
    const { overrides } = get()
    return overrides[actionId] ?? DEFAULT_KEYBINDINGS[actionId].defaultAccelerator
  },

  getAllEffective: () => {
    const { overrides } = get()
    const result = {} as Record<KeybindingActionId, string>
    for (const [id, def] of Object.entries(DEFAULT_KEYBINDINGS)) {
      const actionId = id as KeybindingActionId
      result[actionId] = overrides[actionId] ?? def.defaultAccelerator
    }
    return result
  },

  setOverride: async (actionId, accelerator) => {
    // If the new accelerator matches the default, remove the override instead
    if (accelerator === DEFAULT_KEYBINDINGS[actionId].defaultAccelerator) {
      await get().removeOverride(actionId)
      return
    }

    const next = { ...get().overrides, [actionId]: accelerator }
    set({ overrides: next })
    await persistOverrides(next)
    if (actionId === 'toggle-quick-assistant') await syncQuickAssistantShortcut()
  },

  removeOverride: async (actionId) => {
    const next = { ...get().overrides }
    delete next[actionId]
    set({ overrides: next })
    await persistOverrides(next)
    if (actionId === 'toggle-quick-assistant') await syncQuickAssistantShortcut()
  },

  resetAction: async (actionId) => {
    await get().removeOverride(actionId)
  },

  resetAll: async () => {
    set({ overrides: {} })
    await useSettingsStore.getState().saveSettings({ [STORAGE_KEY]: JSON.stringify({}) })
    await syncQuickAssistantShortcut()
  },
}))
