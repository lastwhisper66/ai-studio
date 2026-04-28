import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import type {
  ChatCompletionContentPart,
  ChatCompletionMessageParam,
} from 'openai/resources/chat/completions'
import { IpcChannels } from '@shared/ipc-channels'
import type {
  SendMessagePayload,
  IpcResult,
  Message,
  FileData,
  ApiSettings,
  ToolCallData,
  ToolCallResultData,
  ToolCallApprovalPayload,
} from '@shared/types'
import { isImageMime } from '@shared/types'
import { ERROR_CODES } from '@shared/errors'
import { toLocalizedError } from '../errors'
import { listMessages, createMessage } from '../db/messages'
import { loadAttachmentBase64 } from '../db/attachments'
import { getConversation, updateConversation } from '../db/conversations'
import { getAssistant } from '../db/assistants'
import { getProvider } from '../db/providers'
import { getMcpServer } from '../db/mcp-servers'
import { createAuditEntry } from '../db/tool-call-audit'
import { streamChat, generateTitle, applySslSetting } from '../ai'
import type { ToolCallFromProvider, StreamChatOptions } from '../ai/stream-chat'
import { McpManager } from '../mcp/mcp-manager'
import { mcpToolsToOpenAIFunctions, parseToolCallName } from '../mcp/tool-converter'
import { showCompletionNotification } from '../utils/notification'

const MAX_TOOL_ROUNDS = 10
const activeStreams = new Map<string, AbortController>()
const pendingApprovals = new Map<
  string,
  { resolve: (approvals: { callId: string; approved: boolean }[]) => void }
>()

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

        // Inject MCP resource context if provided
        if (payload.resourceContext && payload.resourceContext.length > 0) {
          const resourceTexts = payload.resourceContext
            .filter((r) => r.text)
            .map((r) => `[Resource: ${r.uri}]\n${r.text}`)
            .join('\n\n')
          if (resourceTexts) {
            apiMessages.push({
              role: 'system',
              content: `The following resources have been attached as context:\n\n${resourceTexts}`,
            })
          }
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

        // Gather MCP tools
        const mcpManager = McpManager.getInstance()
        const enabledTools = mcpManager.getEnabledTools()
        const openAITools =
          enabledTools.length > 0 ? mcpToolsToOpenAIFunctions(enabledTools) : undefined

        // Build autoApprove lookup
        const serverAutoApprove = new Map<string, boolean>()
        for (const { serverId } of enabledTools) {
          if (!serverAutoApprove.has(serverId)) {
            const srv = getMcpServer(serverId)
            serverAutoApprove.set(serverId, srv?.autoApprove ?? false)
          }
        }

        // Collect all tool calls/results across rounds for final save
        const allToolCalls: ToolCallData[] = []
        const allToolResults: ToolCallResultData[] = []

        let roundIndex = 0
        let hasToolCalls = true

        while (hasToolCalls && roundIndex < MAX_TOOL_ROUNDS) {
          hasToolCalls = false
          let roundToolCalls: ToolCallFromProvider[] = []

          await streamChat(
            {
              settings,
              messages: apiMessages,
              signal: controller.signal,
              reasoningEffort,
              tools: openAITools,
            } as StreamChatOptions,
            {
              onChunk: (delta, isReasoning) => {
                if (isReasoning) {
                  if (!reasoningStartTime) reasoningStartTime = Date.now()
                  fullReasoning += delta
                  if (!sender.isDestroyed()) {
                    sender.send(IpcChannels.CHAT_STREAM_REASONING_CHUNK, {
                      conversationId,
                      delta,
                    })
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
              onToolCalls: (toolCalls) => {
                roundToolCalls = toolCalls
                hasToolCalls = true
              },
            },
          )

          if (!hasToolCalls) break
          if (controller.signal.aborted) break

          // Parse tool calls and build ToolCallData[]
          const parsedCalls: ToolCallData[] = roundToolCalls.map((tc) => {
            const parsed = parseToolCallName(tc.functionName)
            const serverId = parsed?.serverId ?? ''
            const toolName = parsed?.toolName ?? tc.functionName
            const srv = getMcpServer(serverId)
            let args: Record<string, unknown> = {}
            try {
              args = JSON.parse(tc.arguments)
            } catch {
              /* use empty */
            }
            return {
              id: tc.id,
              serverId,
              serverName: srv?.name ?? serverId,
              toolName,
              arguments: args,
              status: 'pending' as const,
              autoApprove: serverAutoApprove.get(serverId) ?? false,
            }
          })

          // Push to renderer
          if (!sender.isDestroyed()) {
            sender.send(IpcChannels.CHAT_TOOL_CALLS_REQUESTED, {
              conversationId,
              roundIndex,
              toolCalls: parsedCalls,
            })
          }

          // Handle approval
          const needsApproval = parsedCalls.filter((tc) => !tc.autoApprove)
          const autoApproved = parsedCalls.filter((tc) => tc.autoApprove)
          autoApproved.forEach((tc) => (tc.status = 'approved'))

          let approvalResults: { callId: string; approved: boolean }[] = autoApproved.map((tc) => ({
            callId: tc.id,
            approved: true,
          }))

          if (needsApproval.length > 0) {
            const userApprovals = await new Promise<{ callId: string; approved: boolean }[]>(
              (resolve, reject) => {
                pendingApprovals.set(conversationId, { resolve })
                controller.signal.addEventListener('abort', () => {
                  pendingApprovals.delete(conversationId)
                  reject(new DOMException('Aborted', 'AbortError'))
                })
              },
            )
            pendingApprovals.delete(conversationId)
            approvalResults = [...approvalResults, ...userApprovals]
          }

          // Execute tools in parallel
          const rejectedCalls = parsedCalls.filter((call) => {
            const approval = approvalResults.find((a) => a.callId === call.id)
            return !approval?.approved
          })
          const approvedCalls = parsedCalls.filter((call) => {
            const approval = approvalResults.find((a) => a.callId === call.id)
            return approval?.approved
          })

          for (const call of rejectedCalls) {
            call.status = 'rejected'
            allToolCalls.push(call)
            allToolResults.push({
              callId: call.id,
              content: [{ type: 'text', text: 'Tool call rejected by user' }],
              isError: true,
            })
            if (!sender.isDestroyed()) {
              sender.send(IpcChannels.CHAT_TOOL_CALL_PROGRESS, {
                conversationId,
                callId: call.id,
                status: 'rejected',
              })
            }
          }

          if (!controller.signal.aborted && approvedCalls.length > 0) {
            for (const call of approvedCalls) {
              call.status = 'running'
              if (!sender.isDestroyed()) {
                sender.send(IpcChannels.CHAT_TOOL_CALL_PROGRESS, {
                  conversationId,
                  callId: call.id,
                  status: 'running',
                })
              }
            }

            const results = await Promise.allSettled(
              approvedCalls.map(async (call) => {
                const startTime = Date.now()
                try {
                  const result = await mcpManager.callTool(
                    call.serverId,
                    call.toolName,
                    call.arguments,
                  )
                  call.status = 'completed'
                  const toolResult: ToolCallResultData = {
                    callId: call.id,
                    content: result.content as unknown[],
                    isError: result.isError ?? false,
                  }
                  allToolResults.push(toolResult)
                  if (!sender.isDestroyed()) {
                    sender.send(IpcChannels.CHAT_TOOL_CALL_PROGRESS, {
                      conversationId,
                      callId: call.id,
                      status: 'completed',
                      result: toolResult,
                    })
                  }
                  return { call, toolResult, durationMs: Date.now() - startTime }
                } catch (err) {
                  call.status = 'error'
                  const errMsg = err instanceof Error ? err.message : String(err)
                  const toolResult: ToolCallResultData = {
                    callId: call.id,
                    content: [{ type: 'text', text: errMsg }],
                    isError: true,
                  }
                  allToolResults.push(toolResult)
                  if (!sender.isDestroyed()) {
                    sender.send(IpcChannels.CHAT_TOOL_CALL_PROGRESS, {
                      conversationId,
                      callId: call.id,
                      status: 'error',
                      result: toolResult,
                    })
                  }
                  return { call, toolResult, durationMs: Date.now() - startTime }
                }
              }),
            )

            for (const r of results) {
              if (r.status === 'fulfilled') {
                allToolCalls.push(r.value.call)
                try {
                  const server = getMcpServer(r.value.call.serverId)
                  createAuditEntry({
                    conversationId,
                    serverId: r.value.call.serverId,
                    serverName: server?.name ?? '',
                    toolName: r.value.call.toolName,
                    arguments: r.value.call.arguments,
                    result: r.value.toolResult.content as unknown[] | null,
                    status: r.value.toolResult.isError ? 'error' : 'completed',
                    isError: r.value.toolResult.isError,
                    durationMs: r.value.durationMs,
                    roundIndex,
                  })
                } catch {
                  /* audit logging is best-effort */
                }
              }
            }
          }

          // Log rejected calls to audit
          for (const call of rejectedCalls) {
            try {
              const server = getMcpServer(call.serverId)
              createAuditEntry({
                conversationId,
                serverId: call.serverId,
                serverName: server?.name ?? '',
                toolName: call.toolName,
                arguments: call.arguments,
                result: null,
                status: 'rejected',
                isError: false,
                durationMs: null,
                roundIndex,
              })
            } catch {
              /* audit logging is best-effort */
            }
          }

          // Inject tool call messages into apiMessages for next round
          // Assistant message with tool_calls
          apiMessages.push({
            role: 'assistant',
            content: fullContent || null,
            tool_calls: parsedCalls.map((tc) => ({
              id: tc.id,
              type: 'function' as const,
              function: {
                name: `${tc.serverId}__${tc.toolName}`,
                arguments: JSON.stringify(tc.arguments),
              },
            })),
          } as ChatCompletionMessageParam)

          // Tool result messages
          for (const call of parsedCalls) {
            const result = allToolResults.find((r) => r.callId === call.id)
            const resultContent = result ? JSON.stringify(result.content) : 'No result'
            apiMessages.push({
              role: 'tool',
              tool_call_id: call.id,
              content: resultContent,
            } as ChatCompletionMessageParam)
          }

          // Reset content accumulators for next round
          fullContent = ''
          fullReasoning = ''
          reasoningStartTime = null
          thinkingDuration = null
          roundIndex++
        }

        // Stream completed — save assistant message
        const duration = Date.now() - streamStartTime
        if (reasoningStartTime && thinkingDuration === null) {
          thinkingDuration = Date.now() - reasoningStartTime
        }
        const savedMessage = createMessage(conversationId, 'assistant', fullContent, {
          duration,
          reasoningContent: fullReasoning || undefined,
          thinkingDuration: thinkingDuration ?? undefined,
          toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
          toolResults: allToolResults.length > 0 ? allToolResults : undefined,
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

  ipcMain.handle(
    IpcChannels.CHAT_TOOL_CALL_APPROVE,
    async (
      _event: IpcMainInvokeEvent,
      payload: ToolCallApprovalPayload,
    ): Promise<IpcResult<void>> => {
      const pending = pendingApprovals.get(payload.conversationId)
      if (pending) {
        pending.resolve(payload.approvals)
      }
      return { success: true }
    },
  )
}
