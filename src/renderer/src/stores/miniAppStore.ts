import { create } from 'zustand'
import type { MiniApp } from '@shared/types'

/** An open tab. Tabs stay mounted while open so their page state survives switching. */
export interface MiniAppTab {
  appId: string
  /** Current page title reported by the guest; falls back to the app name. */
  title: string
}

interface MiniAppState {
  apps: MiniApp[]
  isLoaded: boolean
  /** Open tabs, in user-visible order. */
  tabs: MiniAppTab[]
  activeTabId: string | null

  loadApps: () => Promise<void>
  createApp: (data: {
    name: string
    url: string
    icon?: string
    color?: string
    userAgent?: string
  }) => Promise<MiniApp | null>
  updateApp: (
    id: string,
    data: Partial<Pick<MiniApp, 'name' | 'url' | 'icon' | 'color' | 'userAgent' | 'enabled'>>,
  ) => Promise<void>
  deleteApp: (id: string) => Promise<void>
  reorderApps: (ids: string[]) => Promise<void>
  clearSession: (id: string) => Promise<boolean>

  openTab: (appId: string) => void
  closeTab: (appId: string) => void
  /** null shows the app grid without closing any tab. */
  setActiveTab: (appId: string | null) => void
  setTabTitle: (appId: string, title: string) => void
}

export const useMiniAppStore = create<MiniAppState>((set, get) => ({
  apps: [],
  isLoaded: false,
  tabs: [],
  activeTabId: null,

  loadApps: async () => {
    const result = await window.api.listMiniApps()
    if (result.success && result.data) {
      set({ apps: result.data, isLoaded: true })
    } else {
      console.error('[miniAppStore] loadApps failed:', result.error)
    }
  },

  createApp: async (data) => {
    const result = await window.api.createMiniApp(data)
    if (result.success && result.data) {
      set((state) => ({ apps: [...state.apps, result.data!] }))
      return result.data
    }
    console.error('[miniAppStore] createApp failed:', result.error)
    return null
  },

  updateApp: async (id, data) => {
    const result = await window.api.updateMiniApp(id, data)
    if (result.success && result.data) {
      const updated = result.data
      set((state) => ({ apps: state.apps.map((a) => (a.id === id ? updated : a)) }))
    }
  },

  deleteApp: async (id) => {
    const result = await window.api.deleteMiniApp(id)
    if (result.success) {
      // Drop any open tab too — its webview would otherwise point at a
      // now-nonexistent app.
      get().closeTab(id)
      set((state) => ({ apps: state.apps.filter((a) => a.id !== id) }))
    }
  },

  reorderApps: async (ids) => {
    let previous: MiniApp[] = []
    set((state) => {
      previous = state.apps
      const map = new Map(state.apps.map((a) => [a.id, a]))
      const reordered = ids.map((id, i) => ({ ...map.get(id)!, sortOrder: i }))
      const remaining = state.apps
        .filter((a) => !ids.includes(a.id))
        .map((a, i) => ({ ...a, sortOrder: ids.length + i }))
      return { apps: [...reordered, ...remaining] }
    })
    const result = await window.api.reorderMiniApps(ids)
    if (!result.success) {
      console.error('[miniAppStore] reorderApps failed, rolling back:', result.error)
      set({ apps: previous })
    }
  },

  clearSession: async (id) => {
    const result = await window.api.clearMiniAppSession(id)
    if (!result.success) {
      console.error('[miniAppStore] clearSession failed:', result.error)
      return false
    }
    return true
  },

  openTab: (appId) => {
    set((state) => {
      if (state.tabs.some((t) => t.appId === appId)) {
        // Already open — just surface it, keeping its live page intact.
        return { activeTabId: appId }
      }
      const app = state.apps.find((a) => a.id === appId)
      return {
        tabs: [...state.tabs, { appId, title: app?.name ?? appId }],
        activeTabId: appId,
      }
    })
  },

  closeTab: (appId) => {
    set((state) => {
      const index = state.tabs.findIndex((t) => t.appId === appId)
      if (index === -1) return state
      const tabs = state.tabs.filter((t) => t.appId !== appId)

      let activeTabId = state.activeTabId
      if (activeTabId === appId) {
        // Fall back to the neighbour on the right, else the left, else the grid.
        activeTabId = tabs[index]?.appId ?? tabs[index - 1]?.appId ?? null
      }
      return { tabs, activeTabId }
    })
  },

  setActiveTab: (appId) => set({ activeTabId: appId }),

  setTabTitle: (appId, title) => {
    const trimmed = title.trim()
    if (!trimmed) return
    set((state) => ({
      tabs: state.tabs.map((t) => (t.appId === appId ? { ...t, title: trimmed } : t)),
    }))
  },
}))
