import { createOpenAIClient } from './openai-client'
import { applyExtraParams } from './extra-params'
import type { StreamChatOptions, StreamCallbacks } from './stream-chat'
import type { ResponseCreateParamsStreaming } from 'openai/resources/responses/responses'

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
    applyExtraParams(
      {
        model: settings.model,
        input,
        stream: true,
        ...(settings.temperature !== undefined ? { temperature: settings.temperature } : {}),
        ...(settings.topP !== undefined ? { top_p: settings.topP } : {}),
        ...(settings.maxCompletionTokens !== undefined
          ? { max_output_tokens: settings.maxCompletionTokens }
          : {}),
      } as unknown as Record<string, unknown>,
      settings.extraParams,
    ) as unknown as ResponseCreateParamsStreaming,
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
