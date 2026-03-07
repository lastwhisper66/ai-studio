import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { APIUserAbortError } from 'openai'
import { IpcChannels } from '@shared/ipc-channels'
import type { SendMessagePayload, IpcResult, Message } from '@shared/types'
import { listMessages, createMessage } from '../db/messages'
import { updateConversation } from '../db/conversations'
import { createAIClient, loadApiSettings, generateTitle } from '../ai'

const activeStreams = new Map<string, AbortController>()

export function registerChatHandlers(): void {
  ipcMain.handle(
    IpcChannels.CHAT_SEND_MESSAGE,
    async (event: IpcMainInvokeEvent, payload: SendMessagePayload): Promise<IpcResult<void>> => {
      const { conversationId } = payload
      const sender = event.sender
      let fullContent = ''

      try {
        const settings = loadApiSettings()
        const messages = listMessages(conversationId)

        // Build API messages array
        const apiMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = []
        if (settings.systemPrompt) {
          apiMessages.push({ role: 'system', content: settings.systemPrompt })
        }
        for (const msg of messages) {
          if (msg.role === 'user' || msg.role === 'assistant') {
            apiMessages.push({ role: msg.role, content: msg.content })
          }
        }

        const client = createAIClient(settings)
        const controller = new AbortController()
        activeStreams.set(conversationId, controller)

        const stream = await client.chat.completions.create(
          {
            model: settings.model,
            messages: apiMessages,
            stream: true,
            max_tokens: settings.maxTokens,
            temperature: settings.temperature,
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
