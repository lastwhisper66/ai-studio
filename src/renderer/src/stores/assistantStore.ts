import { create } from 'zustand'
import type { Assistant } from '@shared/types'

interface AssistantStore {
  assistants: Assistant[]
  isLoaded: boolean
  selectedAssistantId: string | null
  activeAssistantId: string | null

  loadAssistants: () => Promise<void>
  addAssistant: (data: Partial<Assistant> & { name: string }) => Promise<Assistant | undefined>
  updateAssistant: (id: string, data: Partial<Assistant>) => Promise<void>
  deleteAssistant: (id: string) => Promise<void>
  setSelectedAssistantId: (id: string | null) => void
  setActiveAssistantId: (id: string | null) => void
}

export const useAssistantStore = create<AssistantStore>((set, get) => ({
  assistants: [],
  isLoaded: false,
  selectedAssistantId: null,
  activeAssistantId: null,

  loadAssistants: async () => {
    const result = await window.api.listAssistants()
    if (result.success && result.data) {
      const defaultAssistant = result.data.find((a) => a.isDefault)
      set({
        assistants: result.data,
        isLoaded: true,
        selectedAssistantId: get().selectedAssistantId ?? result.data[0]?.id ?? null,
        activeAssistantId:
          get().activeAssistantId ?? defaultAssistant?.id ?? result.data[0]?.id ?? null,
      })
    }
  },

  addAssistant: async (data) => {
    const result = await window.api.createAssistant(data)
    if (result.success && result.data) {
      const assistant = result.data
      set((state) => ({
        assistants: [...state.assistants, assistant],
        selectedAssistantId: assistant.id,
      }))
      return assistant
    }
    return undefined
  },

  updateAssistant: async (id, data) => {
    const result = await window.api.updateAssistant(id, data)
    if (result.success && result.data) {
      const updated = result.data
      set((state) => ({
        assistants: state.assistants.map((a) => (a.id === id ? updated : a)),
      }))
    }
  },

  deleteAssistant: async (id) => {
    const result = await window.api.deleteAssistant(id)
    if (result.success) {
      set((state) => {
        const assistants = state.assistants.filter((a) => a.id !== id)
        const wasSelected = state.selectedAssistantId === id
        return {
          assistants,
          selectedAssistantId: wasSelected
            ? (assistants[0]?.id ?? null)
            : state.selectedAssistantId,
        }
      })
    }
  },

  setSelectedAssistantId: (id) => set({ selectedAssistantId: id }),
  setActiveAssistantId: (id) => set({ activeAssistantId: id }),
}))
