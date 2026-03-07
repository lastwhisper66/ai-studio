import { create } from 'zustand'
import type { Conversation, Message, MessageRole } from '@shared/types'

interface ConversationState {
  conversations: Conversation[]
  activeConversationId: string | null
  messages: Message[]
  isLoading: boolean
  error: string | null

  loadConversations: () => Promise<void>
  createConversation: (title?: string) => Promise<boolean>
  deleteConversation: (id: string) => Promise<void>
  renameConversation: (id: string, title: string) => Promise<void>
  setActiveConversation: (id: string) => Promise<void>
  addMessage: (role: MessageRole, content: string) => Promise<void>
  clearError: () => void
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  loadConversations: async () => {
    const result = await window.api.listConversations()
    if (result.success && result.data) {
      set({ conversations: result.data })
    } else {
      set({ error: result.error ?? 'Failed to load conversations' })
    }
  },

  createConversation: async (title?: string) => {
    const result = await window.api.createConversation(title)
    if (result.success && result.data) {
      const conversation = result.data
      set((state) => ({
        conversations: [conversation, ...state.conversations],
        activeConversationId: conversation.id,
        messages: [],
      }))
      return true
    }
    set({ error: result.error ?? 'Failed to create conversation' })
    return false
  },

  deleteConversation: async (id: string) => {
    const result = await window.api.deleteConversation(id)
    if (result.success) {
      const { activeConversationId, conversations } = get()
      const remaining = conversations.filter((c) => c.id !== id)

      if (activeConversationId === id) {
        const nextId = remaining.length > 0 ? remaining[0].id : null
        set({ conversations: remaining, activeConversationId: nextId, messages: [] })
        if (nextId) {
          const msgResult = await window.api.listMessages(nextId)
          if (msgResult.success && msgResult.data) {
            set({ messages: msgResult.data })
          }
        }
      } else {
        set({ conversations: remaining })
      }
    } else {
      set({ error: result.error ?? 'Failed to delete conversation' })
    }
  },

  renameConversation: async (id: string, title: string) => {
    const result = await window.api.updateConversation(id, { title })
    if (result.success && result.data) {
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, title: result.data!.title } : c,
        ),
      }))
    } else {
      set({ error: result.error ?? 'Failed to rename conversation' })
    }
  },

  setActiveConversation: async (id: string) => {
    set({ activeConversationId: id, isLoading: true })
    const result = await window.api.listMessages(id)
    if (result.success && result.data) {
      set({ messages: result.data, isLoading: false })
    } else {
      set({ isLoading: false, error: result.error ?? 'Failed to load messages' })
    }
  },

  addMessage: async (role: MessageRole, content: string) => {
    const activeConversationId = get().activeConversationId
    if (!activeConversationId) return

    const result = await window.api.createMessage(activeConversationId, role, content)
    if (result.success && result.data) {
      const newMessage = result.data

      // Use updater form to avoid stale state after await
      const isFirstMessage = get().messages.length === 0
      set((state) => ({ messages: [...state.messages, newMessage] }))

      // Auto-set conversation title from first user message
      if (role === 'user' && isFirstMessage) {
        const title = content.length > 30 ? content.slice(0, 30) + '...' : content
        const updateResult = await window.api.updateConversation(activeConversationId, { title })
        if (updateResult.success && updateResult.data) {
          const updatedTitle = updateResult.data.title
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c.id === activeConversationId ? { ...c, title: updatedTitle } : c,
            ),
          }))
        }
      }
    } else {
      set({ error: result.error ?? 'Failed to send message' })
    }
  },
}))
