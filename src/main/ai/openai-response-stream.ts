import { createOpenAIClient } from './openai-client'
import type { StreamChatOptions, StreamCallbacks } from './stream-chat'

/** Stream chat using OpenAI Responses API (client.responses.create). */
export async function streamOpenAIResponse(
  options: StreamChatOptions,
  callbacks: StreamCallbacks,
): Promise<void> {
  const { settings, messages, signal } = options
  const client = createOpenAIClient(settings)

  // Convert ChatCompletionMessageParam[] to Responses API input format
  const input = messages.map((msg) => ({
    role: msg.role as 'system' | 'user' | 'assistant',
    content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
  }))

  const stream = await client.responses.create(
    {
      model: settings.model,
      input,
      stream: true,
      temperature: settings.temperature,
      top_p: settings.topP,
      max_output_tokens: settings.maxCompletionTokens,
    },
    { signal },
  )

  for await (const event of stream) {
    if (
      event.type === 'response.output_text.delta' &&
      'delta' in event &&
      typeof event.delta === 'string'
    ) {
      callbacks.onChunk(event.delta)
    }
  }

  callbacks.onEnd?.()
}
