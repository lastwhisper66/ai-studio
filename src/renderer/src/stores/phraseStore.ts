import { create } from 'zustand'
import type { Phrase } from '@shared/types'

interface PhraseState {
  phrases: Phrase[]
  isLoading: boolean
  loadPhrases: () => Promise<void>
  createPhrase: (title: string, content: string) => Promise<Phrase | undefined>
  updatePhrase: (id: string, data: Partial<Pick<Phrase, 'title' | 'content'>>) => Promise<void>
  deletePhrase: (id: string) => Promise<void>
  clearPhrases: () => Promise<void>
}

export const usePhraseStore = create<PhraseState>((set) => ({
  phrases: [],
  isLoading: false,

  loadPhrases: async () => {
    set({ isLoading: true })
    const result = await window.api.listPhrases()
    if (result.success && result.data) {
      set({ phrases: result.data, isLoading: false })
    } else {
      set({ isLoading: false })
    }
  },

  createPhrase: async (title, content) => {
    const result = await window.api.createPhrase(title, content)
    if (result.success && result.data) {
      set((s) => ({ phrases: [...s.phrases, result.data!] }))
      return result.data
    }
    return undefined
  },

  updatePhrase: async (id, data) => {
    const result = await window.api.updatePhrase(id, data)
    if (result.success && result.data) {
      set((s) => ({
        phrases: s.phrases.map((p) => (p.id === id ? result.data! : p)),
      }))
    } else if (!result.success) {
      console.error('Failed to update phrase:', result.error)
    }
  },

  deletePhrase: async (id) => {
    const result = await window.api.deletePhrase(id)
    if (result.success) {
      set((s) => ({ phrases: s.phrases.filter((p) => p.id !== id) }))
    }
  },

  clearPhrases: async () => {
    const result = await window.api.clearPhrases()
    if (result.success) {
      set({ phrases: [] })
    }
  },
}))

export function initPhraseStore(): void {
  usePhraseStore.getState().loadPhrases()
}
