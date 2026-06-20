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
      ...(settings.temperature !== undefined ? { temperature: settings.temperature } : {}),
      ...(settings.topP !== undefined ? { top_p: settings.topP } : {}),
      ...(settings.maxCompletionTokens !== undefined
        ? { max_output_tokens: settings.maxCompletionTokens }
        : {}),
    },
    { signal },
  )

  for await (const event of stream) {
    const completedEvent = event as {
      type: string
      response?: {
        usage?: {
          input_tokens?: number | null
          output_tokens?: number | null
        }
      }
    }
    if (completedEvent.type === 'response.completed' && completedEvent.response?.usage) {
      callbacks.onUsage?.({
        inputTokens: completedEvent.response.usage.input_tokens ?? null,
        outputTokens: completedEvent.response.usage.output_tokens ?? null,
      })
    }

    if (
      event.type === 'response.output_text.delta' &&
      'delta' in event &&
      typeof event.delta === 'string'
    ) {
      callbacks.onChunk(event.delta)
    }
    // reasoning events may not be in the SDK types yet — use type assertion
    const eventType = (event as { type: string }).type
    if (eventType === 'response.reasoning.delta') {
      const delta = (event as { delta?: string }).delta
      if (typeof delta === 'string') {
        callbacks.onChunk(delta, true)
      }
    }
  }

  callbacks.onEnd?.()
}
