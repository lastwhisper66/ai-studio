import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import type { ApiSettings } from '@shared/types'
import { getSetting } from '../db/settings'
import { createOpenAIClient } from './openai-client'
import { streamChat, OPENAI_COMPATIBLE_TYPES } from './stream-chat'

export { streamChat, OPENAI_COMPATIBLE_TYPES }
export type { StreamCallbacks, StreamChatOptions, TokenUsage } from './stream-chat'

/** Sync the NODE_TLS_REJECT_UNAUTHORIZED env var with the user's SSL setting. */
export function applySslSetting(skip?: boolean): void {
  const shouldSkip = skip ?? getSetting('app.skipSslVerify') === 'true'
  if (shouldSkip) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  } else {
    delete process.env.NODE_TLS_REJECT_UNAUTHORIZED
  }
}

export function createAIClient(settings: ApiSettings): OpenAI {
  return createOpenAIClient(settings)
}

/**
 * Generate a conversation title using the appropriate provider.
 * For non-OpenAI-compatible providers, uses streamChat internally.
 */
/** Strip quotes, newlines, and leading/trailing punctuation from a generated title. */
function cleanTitle(raw: string): string {
  return raw
    .replace(/["'""''`\r\n]+/g, ' ')
    .replace(/^[\s.,!?;:…]+|[\s.,!?;:…]+$/g, '')
    .trim()
}

export async function generateTitle(
  settings: ApiSettings,
  userMessage: string,
  assistantMessage: string,
): Promise<string> {
  const titleMessages: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content:
        'Summarize this conversation into a title within 10 characters, in the same language as the conversation. Do not use punctuation or special symbols. Output only the title string without anything else.',
    },
    { role: 'user', content: userMessage },
    { role: 'assistant', content: assistantMessage.slice(0, 500) },
  ]

  // 1. Prefer the configured utility model.
  try {
    const { runUtilityCompletion } = await import('../utility-llm')
    const raw = await runUtilityCompletion({
      task: 'title',
      messages: titleMessages,
      signal: AbortSignal.timeout(15_000),
      temperature: 0.5,
      maxCompletionTokens: 50,
    })
    const cleaned = cleanTitle(raw)
    if (cleaned) return cleaned
  } catch {
    // utility model not configured OR network error — fall through.
  }

  // 2. Fall back to the conversation's own assistant model.
  try {
    if (OPENAI_COMPATIBLE_TYPES.has(settings.provider)) {
      const client = createOpenAIClient(settings)
      const response = await client.chat.completions.create({
        model: settings.model,
        messages: titleMessages,
        max_completion_tokens: 50,
        temperature: 0.5,
      })
      const title = cleanTitle(response.choices[0]?.message?.content ?? '')
      if (title) return title
    } else {
      let title = ''
      const titleSettings = { ...settings, temperature: 0.5, maxCompletionTokens: 50 }
      await streamChat(
        {
          settings: titleSettings,
          messages: titleMessages,
          signal: AbortSignal.timeout(15_000),
        },
        {
          onChunk: (delta) => {
            title += delta
          },
        },
      )
      const cleaned = cleanTitle(title)
      if (cleaned) return cleaned
    }
  } catch {
    // fallback below
  }

  // 3. Last-resort fallback: leading slice of user message.
  return userMessage.slice(0, 20)
}
