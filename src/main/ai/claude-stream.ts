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

  const systemPrompts: string[] = []
  const claudeMessages: Anthropic.MessageParam[] = []

  for (const msg of messages) {
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
    if (msg.role === 'system') {
      systemPrompts.push(content)
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
      ...(systemPrompts.length > 0 ? { system: systemPrompts.join('\n\n') } : {}),
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
  await stream.finalMessage()

  callbacks.onEnd?.()
}
