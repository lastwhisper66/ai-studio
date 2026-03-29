import { create } from 'zustand'
import type { Conversation, Message, MessageRole, FileData, ReasoningEffort } from '@shared/types'
import { isImageMime } from '@shared/types'

import { useAssistantStore } from './assistantStore'

interface ConversationState {
  conversations: Conversation[]
  activeConversationId: string | null
  messages: Message[]
  hasMoreMessages: boolean
  isLoading: boolean
  error: string | null
  isStreaming: boolean
  streamingContent: string
  streamStartTime: number | null

  loadConversations: () => Promise<void>
  createConversation: (title?: string, assistantId?: string) => Promise<boolean>
  deleteConversation: (id: string) => Promise<void>
  deleteConversations: (ids: string[]) => Promise<void>
  renameConversation: (id: string, title: string) => Promise<void>
  pinConversation: (id: string) => Promise<void>
  setActiveConversation: (id: string) => Promise<void>
  loadMoreMessages: () => Promise<void>
  addMessage: (role: MessageRole, content: string, files?: FileData[]) => Promise<void>
  deleteMessage: (id: string) => Promise<void>
  clearMessages: (conversationId: string) => Promise<void>
  insertDivider: () => Promise<void>
  sendMessage: (content: string, files?: FileData[], reasoningEffort?: ReasoningEffort) => Promise<void>
  stopGeneration: () => void
  clearError: () => void
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  hasMoreMessages: false,
  isLoading: false,
  error: null,
  isStreaming: false,
  streamingContent: '',
  streamStartTime: null,

  clearError: () => set({ error: null }),

  loadConversations: async () => {
    const result = await window.api.listConversations()
    if (result.success && result.data) {
      set({ conversations: result.data })
    } else {
      set({ error: result.error ?? 'Failed to load conversations' })
    }
  },

  createConversation: async (title?: string, assistantId?: string) => {
    const result = await window.api.createConversation(title, assistantId)
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
      const deletedConversation = conversations.find((c) => c.id === id)
      const remaining = conversations.filter((c) => c.id !== id)

      if (activeConversationId === id) {
        const currentAssistantId =
          deletedConversation?.assistantId ?? useAssistantStore.getState().activeAssistantId
        const sameAssistantRemaining = remaining.filter((c) => c.assistantId === currentAssistantId)
        const nextId = sameAssistantRemaining.length > 0 ? sameAssistantRemaining[0].id : null
        set({
          conversations: remaining,
          activeConversationId: nextId,
          messages: [],
          hasMoreMessages: false,
        })
        if (nextId) {
          const msgResult = await window.api.listMessagesPaginated(nextId)
          if (msgResult.success && msgResult.data) {
            set({ messages: msgResult.data.messages, hasMoreMessages: msgResult.data.hasMore })
          }
        }
      } else {
        set({ conversations: remaining })
      }
    } else {
      set({ error: result.error ?? 'Failed to delete conversation' })
    }
  },

  deleteConversations: async (ids: string[]) => {
    if (ids.length === 0) return
    const result = await window.api.deleteConversations(ids)
    if (result.success) {
      const { activeConversationId, conversations } = get()
      const idSet = new Set(ids)
      const activeConversation = activeConversationId
        ? conversations.find((c) => c.id === activeConversationId)
        : undefined
      const remaining = conversations.filter((c) => !idSet.has(c.id))

      if (activeConversationId && idSet.has(activeConversationId)) {
        const currentAssistantId =
          activeConversation?.assistantId ?? useAssistantStore.getState().activeAssistantId
        const sameAssistantRemaining = remaining.filter((c) => c.assistantId === currentAssistantId)
        const nextId = sameAssistantRemaining.length > 0 ? sameAssistantRemaining[0].id : null
        set({
          conversations: remaining,
          activeConversationId: nextId,
          messages: [],
          hasMoreMessages: false,
        })
        if (nextId) {
          const msgResult = await window.api.listMessagesPaginated(nextId)
          if (msgResult.success && msgResult.data) {
            set({ messages: msgResult.data.messages, hasMoreMessages: msgResult.data.hasMore })
          }
        }
      } else {
        set({ conversations: remaining })
      }
    } else {
      set({ error: result.error ?? 'Failed to delete conversations' })
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

  pinConversation: async (id: string) => {
    const conv = get().conversations.find((c) => c.id === id)
    if (!conv) return
    const result = await window.api.updateConversation(id, { pinned: !conv.pinned })
    if (result.success && result.data) {
      set((state) => ({
        conversations: state.conversations
          .map((c) => (c.id === id ? { ...c, pinned: result.data!.pinned } : c))
          .sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          }),
      }))
    } else {
      set({ error: result.error ?? 'Failed to pin conversation' })
    }
  },

  setActiveConversation: async (id: string) => {
    set({ activeConversationId: id, isLoading: true })
    const result = await window.api.listMessagesPaginated(id)
    if (result.success && result.data) {
      set({
        messages: result.data.messages,
        hasMoreMessages: result.data.hasMore,
        isLoading: false,
      })
    } else {
      set({ isLoading: false, error: result.error ?? 'Failed to load messages' })
    }
  },

  loadMoreMessages: async () => {
    const { activeConversationId, messages, hasMoreMessages } = get()
    if (!activeConversationId || !hasMoreMessages || messages.length === 0) return

    const oldest = messages[0].createdAt
    const result = await window.api.listMessagesPaginated(activeConversationId, undefined, oldest)
    if (result.success && result.data) {
      const loaded = result.data
      set((state) => ({
        messages: [...loaded.messages, ...state.messages],
        hasMoreMessages: loaded.hasMore,
      }))
    }
  },

  addMessage: async (role: MessageRole, content: string, files?: FileData[]) => {
    const activeConversationId = get().activeConversationId
    if (!activeConversationId) return

    const imageFiles = files?.filter((f) => isImageMime(f.mimeType))
    const result = await window.api.createMessage(
      activeConversationId,
      role,
      content,
      imageFiles && imageFiles.length > 0 ? imageFiles : undefined,
    )
    if (result.success && result.data) {
      set((state) => ({ messages: [...state.messages, result.data!] }))
    } else {
      set({ error: result.error ?? 'Failed to send message' })
    }
  },

  deleteMessage: async (id: string) => {
    const result = await window.api.deleteMessage(id)
    if (result.success) {
      set((state) => ({ messages: state.messages.filter((m) => m.id !== id) }))
    } else {
      set({ error: result.error ?? 'Failed to delete message' })
    }
  },

  clearMessages: async (conversationId: string) => {
    const result = await window.api.clearMessages(conversationId)
    if (result.success) {
      const { activeConversationId } = get()
      if (activeConversationId === conversationId) {
        set({ messages: [], hasMoreMessages: false })
      }
    } else {
      set({ error: result.error ?? 'Failed to clear messages' })
    }
  },

  insertDivider: async () => {
    const { activeConversationId } = get()
    if (!activeConversationId) return
    const result = await window.api.insertDivider(activeConversationId)
    if (result.success && result.data) {
      set((state) => ({ messages: [...state.messages, result.data!] }))
    }
  },

  sendMessage: async (content: string, files?: FileData[], reasoningEffort?: ReasoningEffort) => {
    if (get().isStreaming) return

    let conversationId = get().activeConversationId

    // Auto-create conversation if none is active
    if (!conversationId) {
      const assistantId = useAssistantStore.getState().activeAssistantId ?? undefined
      const ok = await get().createConversation(undefined, assistantId)
      if (!ok) return
      conversationId = get().activeConversationId
      if (!conversationId) return
    }

    // Save user message to DB and update local state (also persists images to disk)
    await get().addMessage('user', content, files)

    // Clean up any leftover listeners before registering new ones
    window.api.removeAllStreamListeners()

    set({ isStreaming: true, streamingContent: '', streamStartTime: Date.now() })

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
            streamStartTime: null,
          }))
        } else {
          set({ isStreaming: false, streamingContent: '', streamStartTime: null })
        }
        cleanup()
      }),
    )

    cleanups.push(
      window.api.onStreamError((data) => {
        if (data.conversationId !== conversationId) return
        set({ isStreaming: false, streamingContent: '', streamStartTime: null, error: data.error })
        cleanup()
      }),
    )

    // Title listener registered separately — must NOT be cleaned up by stream
    // end/error, because title generation happens asynchronously AFTER the
    // stream completes. It will be cleaned up by removeAllStreamListeners()
    // at the start of the next sendMessage() call.
    window.api.onTitleUpdated((data) => {
      if (data.conversationId !== conversationId) return
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === data.conversationId ? { ...c, title: data.title } : c,
        ),
      }))
    })

    // Invoke the streaming request
    const result = await window.api.sendMessage({ conversationId, files, reasoningEffort })
    if (!result.success) {
      set({ isStreaming: false, streamingContent: '', streamStartTime: null, error: result.error })
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
