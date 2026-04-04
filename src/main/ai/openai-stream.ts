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
    max_completion_tokens: settings.maxCompletionTokens,
    temperature: settings.temperature,
    top_p: settings.topP,
    ...(reasoningEffort
      ? { reasoning_effort: reasoningEffort as ChatCompletionReasoningEffort }
      : {}),
  }

  const stream = await client.chat.completions.create(createParams, { signal })

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content
    if (delta) {
      callbacks.onChunk(delta)
    }
  }

  callbacks.onEnd?.()
}
