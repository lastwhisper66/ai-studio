import { createOpenAIClient } from './openai-client'
import type { StreamChatOptions, StreamCallbacks } from './stream-chat'
import type {
  ChatCompletionCreateParamsStreaming,
  ChatCompletionReasoningEffort,
} from 'openai/resources/chat/completions'

/** Stream chat using OpenAI-compatible Chat Completions API. */
export async function streamOpenAIChat(
  options: StreamChatOptions,
  callbacks: StreamCallbacks,
): Promise<void> {
  const { settings, messages, signal, reasoningEffort } = options
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
  }

  const stream = await client.chat.completions.create(createParams, { signal })

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta
    if (delta) {
      // DeepSeek / compatible providers include `reasoning_content` on the delta;
      // the openai SDK types don't include this field, so we use a type assertion.
      const reasoningContent = (delta as Record<string, unknown>)?.reasoning_content as
        | string
        | undefined
      if (reasoningContent) {
        callbacks.onChunk(reasoningContent, true)
      }
      if (delta.content) {
        callbacks.onChunk(delta.content)
      }
    }
  }

  callbacks.onEnd?.()
}
