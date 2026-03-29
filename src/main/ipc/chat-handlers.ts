import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { APIUserAbortError } from 'openai'
import type {
  ChatCompletionContentPart,
  ChatCompletionCreateParamsStreaming,
  ChatCompletionMessageParam,
} from 'openai/resources/chat/completions'
import { IpcChannels } from '@shared/ipc-channels'
import type { SendMessagePayload, IpcResult, Message, FileData, ApiSettings } from '@shared/types'
import { isImageMime } from '@shared/types'
import { listMessages, createMessage } from '../db/messages'
import { loadAttachmentBase64 } from '../db/attachments'
import { getConversation, updateConversation } from '../db/conversations'
import { getAssistant } from '../db/assistants'
import { getProvider } from '../db/providers'
import { listModelsByProvider } from '../db/models'
import { createAIClient, generateTitle, applySslSetting } from '../ai'
import { getSetting } from '../db/settings'

const activeStreams = new Map<string, AbortController>()

export function registerChatHandlers(): void {
  ipcMain.handle(
    IpcChannels.CHAT_SEND_MESSAGE,
    async (event: IpcMainInvokeEvent, payload: SendMessagePayload): Promise<IpcResult<void>> => {
      const { conversationId, files, reasoningEffort } = payload
      const sender = event.sender
      let fullContent = ''
      const streamStartTime = Date.now()

      try {
        const messages = listMessages(conversationId)

        // Resolve conversation and assistant
        const conversation = getConversation(conversationId)
        if (!conversation) {
          return { success: false, error: 'Conversation not found.' }
        }
        const assistant = conversation.assistantId
          ? getAssistant(conversation.assistantId)
          : undefined

        // Model resolution: conversation-level override → assistant-level (required)
        const effectiveProviderId = conversation.providerId ?? assistant?.providerId ?? null
        const effectiveModel = conversation.model ?? assistant?.model ?? ''

        if (!effectiveProviderId) {
          return {
            success: false,
            error:
              'No provider configured. Please set a model for the assistant in Assistant Settings.',
          }
        }

        const provider = getProvider(effectiveProviderId)
        if (!provider) {
          return { success: false, error: 'Provider not found. Please check your configuration.' }
        }
        if (!provider.apiKey) {
          return {
            success: false,
            error: `API key is not configured for provider "${provider.name}". Please set your API key in Settings.`,
          }
        }

        // Resolve model name: explicit → first model of provider
        let modelName = effectiveModel
        if (!modelName) {
          const providerModels = listModelsByProvider(provider.id)
          modelName = providerModels[0]?.name || provider.model || ''
        }
        if (!modelName) {
          return {
            success: false,
            error: `No model configured. Please set a model for the assistant or conversation.`,
          }
        }

        // Build settings from provider + assistant params + global fallbacks
        applySslSetting()
        const temperature = assistant?.temperature
          ? parseFloat(assistant.temperature)
          : parseFloat(getSetting('api.temperature') || '0.7')
        const maxCompletionTokens = assistant?.maxCompletionTokens
          ? parseInt(assistant.maxCompletionTokens, 10)
          : parseInt(getSetting('api.maxCompletionTokens') || '4096', 10)
        const topP = assistant?.topP
          ? parseFloat(assistant.topP)
          : parseFloat(getSetting('api.topP') || '1')
        const systemPrompt = assistant?.systemPrompt || getSetting('api.systemPrompt') || ''

        const settings: ApiSettings = {
          provider: provider.type,
          apiKey: provider.apiKey,
          baseUrl: provider.baseUrl,
          model: modelName,
          endpoint: provider.endpoint,
          apiVersion: provider.apiVersion,
          deploymentName: provider.deploymentName,
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
        const contextCountStr = assistant?.contextCount || getSetting('api.contextCount')
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

        const client = createAIClient(settings)
        const controller = new AbortController()
        activeStreams.set(conversationId, controller)

        const createParams: ChatCompletionCreateParamsStreaming = {
          model: settings.model,
          messages: apiMessages,
          stream: true,
          max_completion_tokens: settings.maxCompletionTokens,
          temperature: settings.temperature,
          top_p: settings.topP,
          ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
        }

        const stream = await client.chat.completions.create(createParams, {
          signal: controller.signal,
        })

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content
          if (delta) {
            fullContent += delta
            if (!sender.isDestroyed()) {
              sender.send(IpcChannels.CHAT_STREAM_CHUNK, { conversationId, delta })
            }
          }
        }

        // Stream completed — save assistant message
        const duration = Date.now() - streamStartTime
        const savedMessage = createMessage(
          conversationId,
          'assistant',
          fullContent,
          undefined,
          duration,
        )
        if (!sender.isDestroyed()) {
          sender.send(IpcChannels.CHAT_STREAM_END, { conversationId, message: savedMessage })
        }

        activeStreams.delete(conversationId)

        // Auto-generate title for first conversation turn
        const userMessages = messages.filter((m) => m.role === 'user')
        if (userMessages.length === 1 && fullContent) {
          const title = await generateTitle(
            client,
            settings.model,
            userMessages[0].content,
            fullContent,
          )
          updateConversation(conversationId, { title })
          if (!sender.isDestroyed()) {
            sender.send(IpcChannels.CHAT_TITLE_UPDATED, { conversationId, title })
          }
        }

        return { success: true }
      } catch (error: unknown) {
        activeStreams.delete(conversationId)

        const isAborted =
          error instanceof APIUserAbortError ||
          (error instanceof Error && error.name === 'AbortError')
        if (isAborted) {
          // User stopped generation — save partial content if any
          const duration = Date.now() - streamStartTime
          let savedMessage: Message | null = null
          if (fullContent) {
            savedMessage = createMessage(
              conversationId,
              'assistant',
              fullContent,
              undefined,
              duration,
            )
          }
          if (!sender.isDestroyed()) {
            sender.send(IpcChannels.CHAT_STREAM_END, { conversationId, message: savedMessage })
          }
          return { success: true }
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        if (!sender.isDestroyed()) {
          sender.send(IpcChannels.CHAT_STREAM_ERROR, { conversationId, error: errorMessage })
        }
        return { success: false, error: errorMessage }
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
