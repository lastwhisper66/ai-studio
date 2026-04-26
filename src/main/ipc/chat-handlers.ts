import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import type {
  ChatCompletionContentPart,
  ChatCompletionMessageParam,
} from 'openai/resources/chat/completions'
import { IpcChannels } from '@shared/ipc-channels'
import type { SendMessagePayload, IpcResult, Message, FileData, ApiSettings } from '@shared/types'
import { isImageMime } from '@shared/types'
import { ERROR_CODES } from '@shared/errors'
import { toLocalizedError } from '../errors'
import { listMessages, createMessage } from '../db/messages'
import { loadAttachmentBase64 } from '../db/attachments'
import { getConversation, updateConversation } from '../db/conversations'
import { getAssistant } from '../db/assistants'
import { getProvider } from '../db/providers'
import { streamChat, generateTitle, applySslSetting } from '../ai'
import { showCompletionNotification } from '../utils/notification'

const activeStreams = new Map<string, AbortController>()

export function registerChatHandlers(): void {
  ipcMain.handle(
    IpcChannels.CHAT_SEND_MESSAGE,
    async (event: IpcMainInvokeEvent, payload: SendMessagePayload): Promise<IpcResult<void>> => {
      const { conversationId, files, reasoningEffort, resendMessageId } = payload
      const sender = event.sender
      let fullContent = ''
      let fullReasoning = ''
      const streamStartTime = Date.now()
      let reasoningStartTime: number | null = null
      let thinkingDuration: number | null = null

      try {
        const allMessages = listMessages(conversationId)

        // When resending, truncate context up to (inclusive) the target user message
        let messages = allMessages
        if (resendMessageId) {
          const idx = allMessages.findIndex((m) => m.id === resendMessageId)
          if (idx === -1) {
            return { success: false, error: { code: ERROR_CODES.CHAT_RESEND_TARGET_NOT_FOUND } }
          }
          messages = allMessages.slice(0, idx + 1)
        }

        // Resolve conversation and assistant
        const conversation = getConversation(conversationId)
        if (!conversation) {
          return { success: false, error: { code: ERROR_CODES.CHAT_CONVERSATION_NOT_FOUND } }
        }
        const assistant = conversation.assistantId
          ? getAssistant(conversation.assistantId)
          : undefined

        // Model resolution: assistant-level only
        const effectiveProviderId = assistant?.providerId ?? null
        const modelName = assistant?.model ?? ''

        if (!effectiveProviderId) {
          return {
            success: false,
            error: { code: ERROR_CODES.CHAT_NO_PROVIDER },
          }
        }

        const provider = getProvider(effectiveProviderId)
        if (!provider) {
          return { success: false, error: { code: ERROR_CODES.CHAT_PROVIDER_NOT_FOUND } }
        }
        if (!provider.apiKey) {
          return {
            success: false,
            error: {
              code: ERROR_CODES.CHAT_API_KEY_MISSING,
              params: { providerName: provider.name },
            },
          }
        }

        if (!modelName) {
          return {
            success: false,
            error: { code: ERROR_CODES.CHAT_NO_MODEL },
          }
        }

        // Build settings from provider + assistant params (defaults if unset)
        applySslSetting()
        const temperature = assistant?.temperature ? parseFloat(assistant.temperature) : 0.7
        const maxCompletionTokens = assistant?.maxCompletionTokens
          ? parseInt(assistant.maxCompletionTokens, 10)
          : 4096
        const topP = assistant?.topP ? parseFloat(assistant.topP) : 1
        const systemPrompt = assistant?.systemPrompt || ''

        const settings: ApiSettings = {
          provider: provider.type,
          apiKey: provider.apiKey,
          baseUrl: provider.baseUrl,
          model: modelName,
          temperature,
          maxCompletionTokens,
          topP,
          systemPrompt,
        }

        // Build API messages array — content may be string or multipart array for vision
        const apiMessages: ChatCompletionMessageParam[] = []
        if (settings.systemPrompt) {
          apiMessages.push({ role: 'system', content: settings.systemPrompt })
        }

        // Apply context count limit: assistant-level overrides global setting
        // First: find last divider — only messages after it are included
        const lastDividerIdx = messages.map((m) => m.role).lastIndexOf('divider')
        const afterDivider = lastDividerIdx >= 0 ? messages.slice(lastDividerIdx + 1) : messages

        let contextMessages = afterDivider
        const contextCountStr = assistant?.contextCount
        if (contextCountStr) {
          const limit = parseInt(contextCountStr, 10)
          if (!isNaN(limit) && limit < 100) {
            const nonSystemMessages = afterDivider.filter(
              (m) => m.role === 'user' || m.role === 'assistant',
            )
            if (limit === 0) {
              contextMessages = []
            } else {
              contextMessages =
                nonSystemMessages.length > limit
                  ? nonSystemMessages.slice(-limit)
                  : nonSystemMessages
            }
          }
        }

        for (const msg of contextMessages) {
          if (msg.role === 'user' || msg.role === 'assistant') {
            apiMessages.push({ role: msg.role, content: msg.content })
          }
        }

        // Attach image files to the last user message using OpenAI Vision format
        // Source 1: files passed directly in the payload (current send)
        const imageFiles = files?.filter((f: FileData) => isImageMime(f.mimeType)) ?? []

        // Source 2: if no files in payload, check if the last user message has persisted attachments
        const lastUserMsg = [...contextMessages].reverse().find((m) => m.role === 'user')
        if (
          imageFiles.length === 0 &&
          lastUserMsg?.attachments &&
          lastUserMsg.attachments.length > 0
        ) {
          for (const att of lastUserMsg.attachments) {
            if (isImageMime(att.mimeType)) {
              try {
                const base64 = loadAttachmentBase64(att.path)
                imageFiles.push({ name: att.name, mimeType: att.mimeType, base64, size: 0 })
              } catch (e) {
                console.error('[chat] Failed to load attachment:', att.path, e)
              }
            }
          }
        }

        if (imageFiles.length > 0) {
          const lastIdx = apiMessages.length - 1
          if (lastIdx >= 0 && apiMessages[lastIdx].role === 'user') {
            const textContent = apiMessages[lastIdx].content as string
            const parts: ChatCompletionContentPart[] = []
            if (textContent) {
              parts.push({ type: 'text', text: textContent })
            }
            for (const file of imageFiles) {
              parts.push({
                type: 'image_url',
                image_url: { url: `data:${file.mimeType};base64,${file.base64}` },
              })
            }
            apiMessages[lastIdx] = { role: 'user', content: parts }
          } else {
            // No user message to attach images to — skip silently
          }
        }

        const controller = new AbortController()
        activeStreams.set(conversationId, controller)

        await streamChat(
          {
            settings,
            messages: apiMessages,
            signal: controller.signal,
            reasoningEffort,
          },
          {
            onChunk: (delta, isReasoning) => {
              if (isReasoning) {
                if (!reasoningStartTime) {
                  reasoningStartTime = Date.now()
                }
                fullReasoning += delta
                if (!sender.isDestroyed()) {
                  sender.send(IpcChannels.CHAT_STREAM_REASONING_CHUNK, { conversationId, delta })
                }
              } else {
                if (reasoningStartTime && thinkingDuration === null) {
                  thinkingDuration = Date.now() - reasoningStartTime
                }
                fullContent += delta
                if (!sender.isDestroyed()) {
                  sender.send(IpcChannels.CHAT_STREAM_CHUNK, { conversationId, delta })
                }
              }
            },
          },
        )

        // Stream completed — save assistant message
        const duration = Date.now() - streamStartTime
        if (reasoningStartTime && thinkingDuration === null) {
          thinkingDuration = Date.now() - reasoningStartTime
        }
        const savedMessage = createMessage(conversationId, 'assistant', fullContent, {
          duration,
          reasoningContent: fullReasoning || undefined,
          thinkingDuration: thinkingDuration ?? undefined,
        })
        if (!sender.isDestroyed()) {
          sender.send(IpcChannels.CHAT_STREAM_END, { conversationId, message: savedMessage })
        }

        showCompletionNotification('chat')

        activeStreams.delete(conversationId)

        // Auto-generate title for first conversation turn (skip on resend)
        const userMessages = messages.filter((m) => m.role === 'user')
        if (!resendMessageId && userMessages.length === 1 && fullContent) {
          const title = await generateTitle(settings, userMessages[0].content, fullContent)
          updateConversation(conversationId, { title })
          if (!sender.isDestroyed()) {
            sender.send(IpcChannels.CHAT_TITLE_UPDATED, { conversationId, title })
          }
        }

        return { success: true }
      } catch (error: unknown) {
        activeStreams.delete(conversationId)

        const isAborted =
          error instanceof Error &&
          (error.name === 'AbortError' || error.name === 'APIUserAbortError')
        if (isAborted) {
          // User stopped generation — save partial content if any
          const duration = Date.now() - streamStartTime
          if (reasoningStartTime && thinkingDuration === null) {
            thinkingDuration = Date.now() - reasoningStartTime
          }
          let savedMessage: Message | null = null
          if (fullContent || fullReasoning) {
            savedMessage = createMessage(conversationId, 'assistant', fullContent, {
              duration,
              reasoningContent: fullReasoning || undefined,
              thinkingDuration: thinkingDuration ?? undefined,
            })
          }
          if (!sender.isDestroyed()) {
            sender.send(IpcChannels.CHAT_STREAM_END, { conversationId, message: savedMessage })
          }
          return { success: true }
        }

        const localized = toLocalizedError(error)
        if (!sender.isDestroyed()) {
          sender.send(IpcChannels.CHAT_STREAM_ERROR, { conversationId, error: localized })
        }
        return { success: false, error: localized }
      }
    },
  )

  ipcMain.handle(
    IpcChannels.CHAT_STOP_GENERATION,
    async (_event: IpcMainInvokeEvent, conversationId: string): Promise<IpcResult<void>> => {
      const controller = activeStreams.get(conversationId)
      if (controller) {
        controller.abort()
        activeStreams.delete(conversationId)
      }
      return { success: true }
    },
  )
}
