import { create } from 'zustand'
import type { Conversation, Message, MessageRole } from '@shared/types'

interface ConversationState {
  conversations: Conversation[]
  activeConversationId: string | null
  messages: Message[]
  isLoading: boolean
  error: string | null
  isStreaming: boolean
  streamingContent: string

  loadConversations: () => Promise<void>
  createConversation: (title?: string) => Promise<boolean>
  deleteConversation: (id: string) => Promise<void>
  renameConversation: (id: string, title: string) => Promise<void>
  setActiveConversation: (id: string) => Promise<void>
  addMessage: (role: MessageRole, content: string) => Promise<void>
  sendMessage: (content: string) => Promise<void>
  stopGeneration: () => void
  clearError: () => void
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  isLoading: false,
  error: null,
  isStreaming: false,
  streamingContent: '',

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
      set((state) => ({ messages: [...state.messages, result.data!] }))
    } else {
      set({ error: result.error ?? 'Failed to send message' })
    }
  },

  sendMessage: async (content: string) => {
    if (get().isStreaming) return

    let conversationId = get().activeConversationId

    // Auto-create conversation if none is active
    if (!conversationId) {
      const ok = await get().createConversation()
      if (!ok) return
      conversationId = get().activeConversationId
      if (!conversationId) return
    }

    // Save user message to DB and update local state
    await get().addMessage('user', content)

    // Clean up any leftover listeners before registering new ones
    window.api.removeAllStreamListeners()

    set({ isStreaming: true, streamingContent: '' })

    // Register listeners BEFORE invoke to prevent race condition
    const cleanups: (() => void)[] = []
    const cleanup = (): void => {
      for (const fn of cleanups) fn()
      cleanups.length = 0
    }

    cleanups.push(
      window.api.onStreamChunk((data) => {
        if (data.conversationId !== conversationId) return
        set((state) => ({ streamingContent: state.streamingContent + data.delta }))
      }),
    )

    cleanups.push(
      window.api.onStreamEnd((data) => {
        if (data.conversationId !== conversationId) return
        if (data.message) {
          set((state) => ({
            messages: [...state.messages, data.message!],
            isStreaming: false,
            streamingContent: '',
          }))
        } else {
          set({ isStreaming: false, streamingContent: '' })
        }
        cleanup()
      }),
    )

    cleanups.push(
      window.api.onStreamError((data) => {
        if (data.conversationId !== conversationId) return
        set({ isStreaming: false, streamingContent: '', error: data.error })
        cleanup()
      }),
    )

    cleanups.push(
      window.api.onTitleUpdated((data) => {
        if (data.conversationId !== conversationId) return
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === data.conversationId ? { ...c, title: data.title } : c,
          ),
        }))
      }),
    )

    // Invoke the streaming request
    const result = await window.api.sendMessage({ conversationId })
    if (!result.success) {
      set({ isStreaming: false, streamingContent: '', error: result.error })
      cleanup()
    }
  },

  stopGeneration: () => {
    const conversationId = get().activeConversationId
    if (conversationId) {
      window.api.stopGeneration(conversationId)
    }
  },
}))
