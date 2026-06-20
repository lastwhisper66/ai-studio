import Anthropic from '@anthropic-ai/sdk'
import type { StreamChatOptions, StreamCallbacks } from './stream-chat'

/** Stream chat using Anthropic Claude native SDK. */
export async function streamClaudeChat(
  options: StreamChatOptions,
  callbacks: StreamCallbacks,
): Promise<void> {
  const { settings, messages, signal } = options

  const client = new Anthropic({
    apiKey: settings.apiKey,
    baseURL: settings.baseUrl || undefined,
  })

  // Extract system prompt from messages (first system message)
  let systemPrompt: string | undefined
  const claudeMessages: Anthropic.MessageParam[] = []

  for (const msg of messages) {
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
    if (msg.role === 'system') {
      systemPrompt = content
    } else if (msg.role === 'user') {
      claudeMessages.push({ role: 'user', content })
    } else if (msg.role === 'assistant') {
      claudeMessages.push({ role: 'assistant', content })
    }
  }

  const stream = client.messages.stream(
    {
      model: settings.model,
      // Anthropic requires max_tokens — fall back to 4096 when caller leaves it unset.
      max_tokens: settings.maxCompletionTokens ?? 4096,
      messages: claudeMessages,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      ...(settings.temperature !== undefined ? { temperature: settings.temperature } : {}),
      ...(settings.topP !== undefined ? { top_p: settings.topP } : {}),
    },
    { signal },
  )

  stream.on('text', (text) => {
    callbacks.onChunk(text)
  })

  stream.on('thinking', (thinking) => {
    callbacks.onChunk(thinking, true)
  })

  // Wait for the stream to complete
  const finalMessage = await stream.finalMessage()
  callbacks.onUsage?.({
    inputTokens: finalMessage.usage.input_tokens ?? null,
    outputTokens: finalMessage.usage.output_tokens ?? null,
  })

  callbacks.onEnd?.()
}
