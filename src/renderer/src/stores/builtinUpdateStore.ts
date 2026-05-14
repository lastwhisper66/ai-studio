import { create } from 'zustand'
import type { BuiltinCategory, BuiltinUpdatesStatus } from '@shared/types'
import { useAssistantStore } from './assistantStore'
import { useAssistantTemplateStore } from './assistantTemplateStore'
import { useQuickActionStore } from './quickActionStore'
import { useSelectionActionStore } from './selectionActionStore'

interface BuiltinUpdateState {
  status: BuiltinUpdatesStatus | null
  loadStatus: () => Promise<void>
  applyUpdate: (category: BuiltinCategory) => Promise<void>
}

export const useBuiltinUpdateStore = create<BuiltinUpdateState>((set, get) => ({
  status: null,

  loadStatus: async () => {
    const result = await window.api.getBuiltinUpdatesStatus()
    if (result.success && result.data) {
      set({ status: result.data })
    }
  },

  applyUpdate: async (category) => {
    const result = await window.api.applyBuiltinUpdate(category)
    if (!result.success) return

    // Refresh banner status.
    await get().loadStatus()

    // Refresh the data stores that consume the updated rows.
    switch (category) {
      case 'templates':
        await useAssistantTemplateStore.getState().loadTemplates()
        await useAssistantStore.getState().loadAssistants()
        break
      case 'quickActions':
        await useQuickActionStore.getState().loadActions()
        break
      case 'selectionActions':
        await useSelectionActionStore.getState().loadActions()
        break
    }
  },
}))
