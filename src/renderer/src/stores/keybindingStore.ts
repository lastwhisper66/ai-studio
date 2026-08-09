import { create } from 'zustand'
import {
  ALL_SHORTCUTS_DISABLED_KEY,
  DEFAULT_KEYBINDINGS,
  type KeybindingActionId,
} from '@shared/keybindings'
import { useSettingsStore } from './settingsStore'

const STORAGE_KEY = 'app.keybindings'
const DISABLED_KEY = 'app.keybindingsDisabled'

type Overrides = Partial<Record<KeybindingActionId, string>>
type DisabledSet = Partial<Record<KeybindingActionId, true>>

interface KeybindingState {
  overrides: Overrides
  disabled: DisabledSet
  isLoaded: boolean

  init: () => void
  getAccelerator: (actionId: KeybindingActionId) => string
  getBoundAccelerator: (actionId: KeybindingActionId) => string | null
  getEffectiveAccelerator: (actionId: KeybindingActionId) => string | null
  findConflict: (actionId: KeybindingActionId, accelerator: string) => KeybindingActionId | null
  getAllEffective: () => Record<KeybindingActionId, string>
  isDisabled: (actionId: KeybindingActionId) => boolean
  isCleared: (actionId: KeybindingActionId) => boolean
  isOverridden: (actionId: KeybindingActionId) => boolean
  setOverride: (actionId: KeybindingActionId, accelerator: string) => Promise<void>
  removeOverride: (actionId: KeybindingActionId) => Promise<void>
  clearAction: (actionId: KeybindingActionId) => Promise<void>
  resetAction: (actionId: KeybindingActionId) => Promise<void>
  resetAll: () => Promise<void>
  toggleDisabled: (actionId: KeybindingActionId) => Promise<void>
}

function parseOverrides(raw: string | undefined): Overrides {
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Overrides
  } catch {
    return {}
  }
}

function parseDisabled(raw: string | undefined): DisabledSet {
  if (!raw) return {}
  try {
    return JSON.parse(raw) as DisabledSet
  } catch {
    return {}
  }
}

async function persistOverrides(overrides: Overrides): Promise<void> {
  const clean = Object.fromEntries(Object.entries(overrides).filter(([, v]) => v !== undefined))
  await useSettingsStore.getState().saveSettings({ [STORAGE_KEY]: JSON.stringify(clean) })
}

async function persistDisabled(disabled: DisabledSet): Promise<void> {
  const clean = Object.fromEntries(Object.entries(disabled).filter(([, v]) => v))
  await useSettingsStore.getState().saveSettings({ [DISABLED_KEY]: JSON.stringify(clean) })
}

async function syncQuickAssistantShortcut(): Promise<void> {
  try {
    await window.api.updateQuickAssistantShortcut()
  } catch {
    // non-critical
  }
}

async function syncSummonWindowShortcut(): Promise<void> {
  try {
    await window.api.updateSummonWindowShortcut()
  } catch {
    // non-critical
  }
}

async function syncScreenshotShortcut(): Promise<void> {
  try {
    await window.api.updateScreenshotShortcut()
  } catch {
    // non-critical
  }
}

async function syncSelectionShortcut(): Promise<void> {
  try {
    await window.api.updateSelectionShortcut()
  } catch {
    // non-critical
  }
}

async function syncGlobalShortcut(actionId: KeybindingActionId): Promise<void> {
  if (actionId === 'toggle-quick-assistant') await syncQuickAssistantShortcut()
  if (actionId === 'summon-window') await syncSummonWindowShortcut()
  if (actionId === 'screenshot-translate') await syncScreenshotShortcut()
  if (actionId === 'toggle-selection-assistant') await syncSelectionShortcut()
}

export const useKeybindingStore = create<KeybindingState>((set, get) => ({
  overrides: {},
  disabled: {},
  isLoaded: false,

  init: () => {
    const settings = useSettingsStore.getState().settings
    set({
      overrides: parseOverrides(settings[STORAGE_KEY]),
      disabled: parseDisabled(settings[DISABLED_KEY]),
      isLoaded: true,
    })
  },

  // The configured value — override or default, '' if cleared. Deliberately
  // ignores both the per-action disabled flag and the master switch, so it is
  // NOT simply a less-resolved getBoundAccelerator: use it to show what a key
  // is bound to (e.g. a shortcut recorder), never to decide what fires.
  getAccelerator: (actionId) => {
    const { overrides } = get()
    const val = overrides[actionId]
    if (val === '') return ''
    return val ?? DEFAULT_KEYBINDINGS[actionId].defaultAccelerator
  },

  // What this action is bound to: null when it's individually disabled or has
  // no binding (cleared). Ignores the master switch on purpose — use this for
  // conflict detection, which must keep working while shortcuts are suppressed.
  getBoundAccelerator: (actionId) => {
    const { disabled } = get()
    if (disabled[actionId]) return null
    const accel = get().getAccelerator(actionId)
    return accel || null
  },

  // What will actually fire right now: getBoundAccelerator, plus the master
  // switch. Use this for dispatch. Read straight from settingsStore rather than
  // mirroring the flag into this store — settingsStore auto-subscribes to
  // cross-window broadcasts at module load, and this runs per keydown, so it
  // always observes the latest value (including tray-originated flips).
  getEffectiveAccelerator: (actionId) => {
    if (useSettingsStore.getState().settings[ALL_SHORTCUTS_DISABLED_KEY] === 'true') return null
    return get().getBoundAccelerator(actionId)
  },

  // The action already bound to `accelerator`, or null if it's free. Compares
  // against bound (not effective) accelerators so conflicts are still reported
  // while the master switch suppresses everything.
  findConflict: (actionId, accelerator) => {
    const target = accelerator.toLowerCase()
    for (const id of Object.keys(DEFAULT_KEYBINDINGS) as KeybindingActionId[]) {
      if (id === actionId) continue
      const accel = get().getBoundAccelerator(id)
      if (accel && accel.toLowerCase() === target) return id
    }
    return null
  },

  getAllEffective: () => {
    const { overrides } = get()
    const result = {} as Record<KeybindingActionId, string>
    for (const [id, def] of Object.entries(DEFAULT_KEYBINDINGS)) {
      const actionId = id as KeybindingActionId
      const val = overrides[actionId]
      if (val === '') {
        result[actionId] = ''
      } else {
        result[actionId] = val ?? def.defaultAccelerator
      }
    }
    return result
  },

  isDisabled: (actionId) => !!get().disabled[actionId],

  isCleared: (actionId) => get().overrides[actionId] === '',

  isOverridden: (actionId) => {
    const val = get().overrides[actionId]
    return val !== undefined && val !== ''
  },

  setOverride: async (actionId, accelerator) => {
    if (accelerator === DEFAULT_KEYBINDINGS[actionId].defaultAccelerator) {
      await get().removeOverride(actionId)
      return
    }

    const next = { ...get().overrides, [actionId]: accelerator }
    set({ overrides: next })
    await persistOverrides(next)
    await syncGlobalShortcut(actionId)
  },

  removeOverride: async (actionId) => {
    const next = { ...get().overrides }
    delete next[actionId]
    set({ overrides: next })
    await persistOverrides(next)
    await syncGlobalShortcut(actionId)
  },

  clearAction: async (actionId) => {
    const next = { ...get().overrides, [actionId]: '' }
    set({ overrides: next })
    await persistOverrides(next)
    await syncGlobalShortcut(actionId)
  },

  resetAction: async (actionId) => {
    const nextOverrides = { ...get().overrides }
    delete nextOverrides[actionId]
    set({ overrides: nextOverrides })
    await persistOverrides(nextOverrides)
    await syncGlobalShortcut(actionId)
  },

  resetAll: async () => {
    set({ overrides: {}, disabled: {} })
    const save = useSettingsStore.getState().saveSettings
    await save({ [STORAGE_KEY]: JSON.stringify({}), [DISABLED_KEY]: JSON.stringify({}) })
    await Promise.all([
      syncQuickAssistantShortcut(),
      syncSummonWindowShortcut(),
      syncScreenshotShortcut(),
      syncSelectionShortcut(),
    ])
  },

  toggleDisabled: async (actionId) => {
    const { disabled } = get()
    const next = { ...disabled }
    if (next[actionId]) {
      delete next[actionId]
    } else {
      next[actionId] = true
    }
    set({ disabled: next })
    await persistDisabled(next)
    await syncGlobalShortcut(actionId)
  },
}))
