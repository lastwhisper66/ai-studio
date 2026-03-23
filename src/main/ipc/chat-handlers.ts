import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { APIUserAbortError } from 'openai'
import { IpcChannels } from '@shared/ipc-channels'
import type { SendMessagePayload, IpcResult, Message, FileData } from '@shared/types'
import { isImageMime } from '@shared/types'
import { listMessages, createMessage } from '../db/messages'
import { loadAttachmentBase64 } from '../db/attachments'
import { getConversation, updateConversation } from '../db/conversations'
import { getAssistant } from '../db/assistants'
import { getProvider } from '../db/providers'
import { listModelsByProvider } from '../db/models'
import { createAIClient, loadApiSettings, generateTitle } from '../ai'
import { getSetting } from '../db/settings'

const activeStreams = new Map<string, AbortController>()

export function registerChatHandlers(): void {
  ipcMain.handle(
    IpcChannels.CHAT_SEND_MESSAGE,
    async (event: IpcMainInvokeEvent, payload: SendMessagePayload): Promise<IpcResult<void>> => {
      const { conversationId, files } = payload
      const sender = event.sender
      let fullContent = ''

      try {
        const settings = loadApiSettings()
        const messages = listMessages(conversationId)

        // Assistant overlay: if conversation is linked to an assistant,
        // override settings with assistant-specific configuration
        const conversation = getConversation(conversationId)
        const assistant = conversation?.assistantId
          ? getAssistant(conversation.assistantId)
          : undefined
        if (assistant) {
          // Override provider if assistant specifies one
          if (assistant.providerId) {
            const assistantProvider = getProvider(assistant.providerId)
            if (assistantProvider) {
              settings.provider = assistantProvider.type
              settings.apiKey = assistantProvider.apiKey
              settings.baseUrl = assistantProvider.baseUrl
              settings.endpoint = assistantProvider.endpoint
              settings.apiVersion = assistantProvider.apiVersion
              settings.deploymentName = assistantProvider.deploymentName
              // Use assistant's model, or fall back to provider's first model
              const providerModels = listModelsByProvider(assistantProvider.id)
              settings.model =
                assistant.model ||
                providerModels[0]?.name ||
                assistantProvider.model ||
                settings.model
            }
          } else if (assistant.model) {
            // No custom provider, but assistant specifies a model name
            settings.model = assistant.model
          }
          if (assistant.systemPrompt) {
            settings.systemPrompt = assistant.systemPrompt
          }
          if (assistant.temperature) {
            settings.temperature = parseFloat(assistant.temperature)
          }
          if (assistant.maxCompletionTokens) {
            settings.maxCompletionTokens = parseInt(assistant.maxCompletionTokens, 10)
          }
          if (assistant.topP) {
            settings.topP = parseFloat(assistant.topP)
          }
        }

        // Build API messages array — content may be string or multipart array for vision
        type ContentPart =
          | { type: 'text'; text: string }
          | { type: 'image_url'; image_url: { url: string } }
        type ChatMessage = {
          role: 'system' | 'user' | 'assistant'
          content: string | ContentPart[]
        }
        const apiMessages: ChatMessage[] = []
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
            const parts: ContentPart[] = []
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

        const stream = await client.chat.completions.create(
          {
            model: settings.model,
            messages: apiMessages as Parameters<
              typeof client.chat.completions.create
            >[0]['messages'],
            stream: true,
            max_completion_tokens: settings.maxCompletionTokens,
            temperature: settings.temperature,
            top_p: settings.topP,
          },
          { signal: controller.signal },
        )

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
        const savedMessage = createMessage(conversationId, 'assistant', fullContent)
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
          let savedMessage: Message | null = null
          if (fullContent) {
            savedMessage = createMessage(conversationId, 'assistant', fullContent)
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
