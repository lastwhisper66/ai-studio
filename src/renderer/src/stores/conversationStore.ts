import { create } from 'zustand'
import type {
  Conversation,
  Message,
  MessageRole,
  FileData,
  ReasoningEffort,
  SendMessagePayload,
} from '@shared/types'
import { isImageMime } from '@shared/types'
import type { LocalizedError } from '@shared/errors'
import { fallbackLocalizedError } from '@shared/errors'

import { useAssistantStore } from './assistantStore'

interface ConversationState {
  conversations: Conversation[]
  activeConversationId: string | null
  messages: Message[]
  hasMoreMessages: boolean
  isLoading: boolean
  error: LocalizedError | null
  isStreaming: boolean
  streamingContent: string
  streamingReasoningContent: string
  streamStartTime: number | null
  /** When resending, the ID of the message being replaced (the old AI response) */
  resendTargetId: string | null
  /** ID of the user message currently being edited; null = no edit active */
  editingMessageId: string | null
  focusInputTrigger: number
  /** Per-conversation in-memory toggle for web search. Not persisted. */
  webSearchByConversation: Record<string, boolean>
  /**
   * Web-search toggle set BEFORE any conversation is active (e.g. from the
   * WelcomeScreen). Applied to the new conversation as soon as one is created.
   */
  pendingWebSearchEnabled: boolean

  requestInputFocus: () => void
  getWebSearch: (conversationId: string) => boolean
  setWebSearch: (conversationId: string, enabled: boolean) => void
  setPendingWebSearch: (enabled: boolean) => void
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
  sendMessage: (
    content: string,
    files?: FileData[],
    reasoningEffort?: ReasoningEffort,
    webSearch?: boolean,
  ) => Promise<void>
  resendMessage: (userMessageId: string) => Promise<void>
  editMessage: (messageId: string, newContent: string) => Promise<void>
  editAndResendMessage: (messageId: string, newContent: string) => Promise<void>
  setEditingMessageId: (id: string | null) => void
  stopGeneration: () => void
  clearError: () => void
  /**
   * Drop the active conversation selection and its in-memory message list.
   * Used after "Clear all chats" to reset the UI without a relaunch.
   * Does NOT touch streaming state — callers should stop streams first.
   */
  resetActive: () => void
}

export const useConversationStore = create<ConversationState>((set, get) => {
  // ── Private streaming helper shared by sendMessage & resendMessage ──
  async function startStream(opts: {
    conversationId: string
    apiPayload: SendMessagePayload
    resendTargetId: string | null
    registerTitleListener: boolean
  }): Promise<void> {
    const { conversationId, resendTargetId } = opts

    window.api.removeAllStreamListeners()
    set({
      isStreaming: true,
      streamingContent: '',
      streamingReasoningContent: '',
      streamStartTime: Date.now(),
      resendTargetId,
    })

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
      window.api.onStreamReasoningChunk((data) => {
        if (data.conversationId !== conversationId) return
        set((state) => ({
          streamingReasoningContent: state.streamingReasoningContent + data.delta,
        }))
      }),
    )

    cleanups.push(
      window.api.onStreamEnd((data) => {
        if (data.conversationId !== conversationId) return
        const targetId = resendTargetId // captured from closure
        const tempId = `_stopping_${conversationId}`
        if (data.message) {
          set((state) => {
            const hasTemp = state.messages.some((m) => m.id === tempId)
            const filtered = hasTemp
              ? state.messages.filter((m) => m.id !== tempId)
              : state.messages

            let newMessages: Message[]
            if (targetId) {
              const targetIdx = filtered.findIndex((m) => m.id === targetId)
              if (targetIdx !== -1) {
                newMessages = [...filtered]
                newMessages.splice(targetIdx + 1, 0, data.message!)
              } else {
                newMessages = [...filtered, data.message!]
              }
            } else {
              newMessages = [...filtered, data.message!]
            }

            return {
              messages: newMessages,
              isStreaming: false,
              streamingContent: '',
              streamingReasoningContent: '',
              streamStartTime: null,
              resendTargetId: null,
            }
          })
        } else {
          set({
            isStreaming: false,
            streamingContent: '',
            streamingReasoningContent: '',
            streamStartTime: null,
            resendTargetId: null,
          })
        }
        cleanup()
      }),
    )

    cleanups.push(
      window.api.onStreamError((data) => {
        if (data.conversationId !== conversationId) return
        set({
          isStreaming: false,
          streamingContent: '',
          streamingReasoningContent: '',
          streamStartTime: null,
          resendTargetId: null,
          error: data.error,
        })
        cleanup()
      }),
    )

    // Title listener registered separately — must NOT be cleaned up by stream
    // end/error, because title generation happens asynchronously AFTER the
    // stream completes. It will be cleaned up by removeAllStreamListeners()
    // at the start of the next call.
    if (opts.registerTitleListener) {
      window.api.onTitleUpdated((data) => {
        if (data.conversationId !== conversationId) return
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === data.conversationId ? { ...c, title: data.title } : c,
          ),
        }))
      })
    }

    const result = await window.api.sendMessage(opts.apiPayload)
    if (!result.success) {
      set({
        isStreaming: false,
        streamingContent: '',
        streamingReasoningContent: '',
        streamStartTime: null,
        resendTargetId: null,
        error: result.error,
      })
      cleanup()
    }
  }

  return {
    conversations: [],
    activeConversationId: null,
    messages: [],
    hasMoreMessages: false,
    isLoading: false,
    error: null,
    isStreaming: false,
    streamingContent: '',
    streamingReasoningContent: '',
    streamStartTime: null,
    resendTargetId: null,
    editingMessageId: null,
    focusInputTrigger: 0,
    webSearchByConversation: {},
    pendingWebSearchEnabled: false,

    requestInputFocus: () => set((s) => ({ focusInputTrigger: s.focusInputTrigger + 1 })),

    getWebSearch: (conversationId: string) => {
      return get().webSearchByConversation[conversationId] ?? false
    },

    setWebSearch: (conversationId: string, enabled: boolean) => {
      set((state) => ({
        webSearchByConversation: { ...state.webSearchByConversation, [conversationId]: enabled },
      }))
    },

    setPendingWebSearch: (enabled: boolean) => {
      set({ pendingWebSearchEnabled: enabled })
    },

    clearError: () => set({ error: null }),

    resetActive: () => set({ activeConversationId: null, messages: [], hasMoreMessages: false }),

    loadConversations: async () => {
      const result = await window.api.listConversations()
      if (result.success && result.data) {
        set({ conversations: result.data })
      } else {
        set({ error: result.error ?? fallbackLocalizedError('Failed to load conversations') })
      }
    },

    createConversation: async (title?: string, assistantId?: string) => {
      const effectiveAssistantId =
        assistantId ?? useAssistantStore.getState().activeAssistantId ?? undefined
      const result = await window.api.createConversation(title, effectiveAssistantId)
      if (result.success && result.data) {
        const conversation = result.data
        set((state) => {
          const pending = state.pendingWebSearchEnabled
          const nextWebSearchMap = pending
            ? { ...state.webSearchByConversation, [conversation.id]: true }
            : state.webSearchByConversation
          return {
            conversations: [conversation, ...state.conversations],
            activeConversationId: conversation.id,
            messages: [],
            webSearchByConversation: nextWebSearchMap,
            pendingWebSearchEnabled: false,
          }
        })
        get().requestInputFocus()
        return true
      }
      set({ error: result.error ?? fallbackLocalizedError('Failed to create conversation') })
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
          const sameAssistantRemaining = remaining.filter(
            (c) => c.assistantId === currentAssistantId,
          )
          const nextId = sameAssistantRemaining.length > 0 ? sameAssistantRemaining[0].id : null
          set((state) => {
            const nextMap = { ...state.webSearchByConversation }
            delete nextMap[id]
            return {
              conversations: remaining,
              activeConversationId: nextId,
              messages: [],
              hasMoreMessages: false,
              webSearchByConversation: nextMap,
            }
          })
          if (nextId) {
            const msgResult = await window.api.listMessagesPaginated(nextId)
            if (msgResult.success && msgResult.data) {
              set({ messages: msgResult.data.messages, hasMoreMessages: msgResult.data.hasMore })
            }
          }
        } else {
          set((state) => {
            const nextMap = { ...state.webSearchByConversation }
            delete nextMap[id]
            return { conversations: remaining, webSearchByConversation: nextMap }
          })
        }
      } else {
        set({ error: result.error ?? fallbackLocalizedError('Failed to delete conversation') })
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
          const sameAssistantRemaining = remaining.filter(
            (c) => c.assistantId === currentAssistantId,
          )
          const nextId = sameAssistantRemaining.length > 0 ? sameAssistantRemaining[0].id : null
          set((state) => {
            const nextMap = { ...state.webSearchByConversation }
            for (const id of ids) delete nextMap[id]
            return {
              conversations: remaining,
              activeConversationId: nextId,
              messages: [],
              hasMoreMessages: false,
              webSearchByConversation: nextMap,
            }
          })
          if (nextId) {
            const msgResult = await window.api.listMessagesPaginated(nextId)
            if (msgResult.success && msgResult.data) {
              set({ messages: msgResult.data.messages, hasMoreMessages: msgResult.data.hasMore })
            }
          }
        } else {
          set((state) => {
            const nextMap = { ...state.webSearchByConversation }
            for (const id of ids) delete nextMap[id]
            return { conversations: remaining, webSearchByConversation: nextMap }
          })
        }
      } else {
        set({ error: result.error ?? fallbackLocalizedError('Failed to delete conversations') })
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
        set({ error: result.error ?? fallbackLocalizedError('Failed to rename conversation') })
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
        set({ error: result.error ?? fallbackLocalizedError('Failed to pin conversation') })
      }
    },

    setActiveConversation: async (id: string) => {
      set({ activeConversationId: id, isLoading: true, editingMessageId: null })
      const result = await window.api.listMessagesPaginated(id)
      if (result.success && result.data) {
        set({
          messages: result.data.messages,
          hasMoreMessages: result.data.hasMore,
          isLoading: false,
        })
        get().requestInputFocus()
      } else {
        set({
          isLoading: false,
          error: result.error ?? fallbackLocalizedError('Failed to load messages'),
        })
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
        set({ error: result.error ?? fallbackLocalizedError('Failed to send message') })
      }
    },

    deleteMessage: async (id: string) => {
      const result = await window.api.deleteMessage(id)
      if (result.success) {
        set((state) => ({ messages: state.messages.filter((m) => m.id !== id) }))
      } else {
        set({ error: result.error ?? fallbackLocalizedError('Failed to delete message') })
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
        set({ error: result.error ?? fallbackLocalizedError('Failed to clear messages') })
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

    sendMessage: async (
      content: string,
      files?: FileData[],
      reasoningEffort?: ReasoningEffort,
      webSearch?: boolean,
    ) => {
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

      await startStream({
        conversationId,
        apiPayload: { conversationId, files, reasoningEffort, webSearch },
        resendTargetId: null,
        registerTitleListener: true,
      })
    },

    resendMessage: async (userMessageId: string) => {
      if (get().isStreaming) return
      const { messages, activeConversationId } = get()
      if (!activeConversationId) return

      const userMsgIndex = messages.findIndex((m) => m.id === userMessageId)
      if (userMsgIndex === -1) return

      // Lock immediately to prevent double-click races
      set({ isStreaming: true })

      // Delete the AI response right after this user message (if any)
      const nextMsg = messages[userMsgIndex + 1]
      if (nextMsg && nextMsg.role === 'assistant') {
        const deleteResult = await window.api.deleteMessage(nextMsg.id)
        if (!deleteResult.success) {
          set({
            isStreaming: false,
            error: deleteResult.error ?? fallbackLocalizedError('Failed to delete old response'),
          })
          return
        }
        set((state) => ({
          messages: state.messages.filter((m) => m.id !== nextMsg.id),
        }))
      }

      await startStream({
        conversationId: activeConversationId,
        apiPayload: { conversationId: activeConversationId, resendMessageId: userMessageId },
        resendTargetId: userMessageId,
        registerTitleListener: false,
      })
    },

    editMessage: async (messageId: string, newContent: string) => {
      if (get().isStreaming) return
      if (!newContent.trim()) return
      const { messages, activeConversationId } = get()
      if (!activeConversationId) return

      const msgIndex = messages.findIndex((m) => m.id === messageId)
      if (msgIndex === -1 || messages[msgIndex].role !== 'user') return

      // 1. Persist content update to DB
      const updateResult = await window.api.updateMessage(messageId, newContent)
      if (!updateResult.success) {
        set({ error: updateResult.error ?? fallbackLocalizedError('Failed to update message') })
        return
      }

      // 2. Update local state with new content and clear edit mode
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === messageId ? { ...m, content: newContent } : m,
        ),
        editingMessageId: null,
      }))
    },

    editAndResendMessage: async (messageId: string, newContent: string) => {
      await get().editMessage(messageId, newContent)
      await get().resendMessage(messageId)
    },

    setEditingMessageId: (id: string | null) => set({ editingMessageId: id }),

    stopGeneration: () => {
      const {
        activeConversationId: conversationId,
        streamingContent,
        streamingReasoningContent,
        resendTargetId,
      } = get()
      if (!conversationId) return

      window.api.stopGeneration(conversationId)

      // Immediately show partial content as a temporary message so the user
      // sees the response so far while the main process finishes aborting.
      if (streamingContent) {
        const tempMessage: Message = {
          id: `_stopping_${conversationId}`,
          conversationId,
          role: 'assistant',
          content: streamingContent,
          reasoningContent: streamingReasoningContent || null,
          createdAt: new Date().toISOString(),
          tokenCount: null,
          duration: null,
          thinkingDuration: null,
        }
        set((state) => {
          // For resend: insert temp message after the target user message
          if (resendTargetId) {
            const targetIdx = state.messages.findIndex((m) => m.id === resendTargetId)
            if (targetIdx !== -1) {
              const newMessages = [...state.messages]
              newMessages.splice(targetIdx + 1, 0, tempMessage)
              return {
                messages: newMessages,
                isStreaming: false,
                streamingContent: '',
                streamingReasoningContent: '',
                streamStartTime: null,
                resendTargetId: null,
              }
            }
          }
          return {
            messages: [...state.messages, tempMessage],
            isStreaming: false,
            streamingContent: '',
            streamingReasoningContent: '',
            streamStartTime: null,
            resendTargetId: null,
          }
        })
      } else {
        set({
          isStreaming: false,
          streamingContent: '',
          streamingReasoningContent: '',
          streamStartTime: null,
          resendTargetId: null,
        })
      }
    },
  }
})
