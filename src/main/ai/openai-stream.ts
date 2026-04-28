import { createOpenAIClient } from './openai-client'
import type { StreamChatOptions, StreamCallbacks, ToolCallFromProvider } from './stream-chat'
import type {
  ChatCompletionCreateParamsStreaming,
  ChatCompletionReasoningEffort,
} from 'openai/resources/chat/completions'

/** Stream chat using OpenAI-compatible Chat Completions API. */
export async function streamOpenAIChat(
  options: StreamChatOptions,
  callbacks: StreamCallbacks,
): Promise<void> {
  const { settings, messages, signal, reasoningEffort, tools } = options
  const client = createOpenAIClient(settings)

  const createParams: ChatCompletionCreateParamsStreaming = {
    model: settings.model,
    messages,
    stream: true,
    ...(settings.maxCompletionTokens !== undefined
      ? { max_completion_tokens: settings.maxCompletionTokens }
      : {}),
    ...(settings.temperature !== undefined ? { temperature: settings.temperature } : {}),
    ...(settings.topP !== undefined ? { top_p: settings.topP } : {}),
    ...(reasoningEffort
      ? { reasoning_effort: reasoningEffort as ChatCompletionReasoningEffort }
      : {}),
    ...(tools && tools.length > 0 ? { tools } : {}),
  }

  const stream = await client.chat.completions.create(createParams, { signal })

  const pendingToolCalls = new Map<number, { id: string; name: string; args: string }>()

  for await (const chunk of stream) {
    const choice = chunk.choices[0]
    if (!choice) continue
    const delta = choice.delta

    if (delta) {
      const reasoningContent = (delta as Record<string, unknown>)?.reasoning_content as
        | string
        | undefined
      if (reasoningContent) {
        callbacks.onChunk(reasoningContent, true)
      }
      if (delta.content) {
        callbacks.onChunk(delta.content)
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const existing = pendingToolCalls.get(tc.index)
          if (existing) {
            if (tc.function?.arguments) existing.args += tc.function.arguments
          } else {
            pendingToolCalls.set(tc.index, {
              id: tc.id || '',
              name: tc.function?.name || '',
              args: tc.function?.arguments || '',
            })
          }
        }
      }
    }

    if (choice.finish_reason === 'tool_calls' && pendingToolCalls.size > 0) {
      const toolCalls: ToolCallFromProvider[] = [...pendingToolCalls.values()].map((tc) => ({
        id: tc.id,
        functionName: tc.name,
        arguments: tc.args,
      }))
      callbacks.onToolCalls?.(toolCalls)
      return
    }
  }

  callbacks.onEnd?.()
}
