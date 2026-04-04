import OpenAI from 'openai'
import type { ApiSettings } from '@shared/types'
import { getSetting } from '../db/settings'
import { createOpenAIClient } from './openai-client'
import { streamChat, OPENAI_COMPATIBLE_TYPES } from './stream-chat'

export { streamChat, OPENAI_COMPATIBLE_TYPES }
export type { StreamCallbacks, StreamChatOptions } from './stream-chat'

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
export async function generateTitle(
  settings: ApiSettings,
  userMessage: string,
  assistantMessage: string,
): Promise<string> {
  const titleMessages = [
    {
      role: 'system' as const,
      content:
        'Generate a concise title (6 words or less) for this conversation. Return only the title, no quotes or punctuation.',
    },
    { role: 'user' as const, content: userMessage },
    { role: 'assistant' as const, content: assistantMessage.slice(0, 500) },
  ]

  try {
    if (OPENAI_COMPATIBLE_TYPES.has(settings.provider)) {
      // Use OpenAI client directly for title generation (non-streaming, faster)
      const client = createOpenAIClient(settings)
      const response = await client.chat.completions.create({
        model: settings.model,
        messages: titleMessages,
        max_completion_tokens: 30,
        temperature: 0.5,
      })
      const title = response.choices[0]?.message?.content?.trim()
      if (title) return title
    } else {
      // For Gemini/Claude/etc., use streamChat to generate title
      let title = ''
      const titleSettings = { ...settings, temperature: 0.5, maxCompletionTokens: 30 }
      await streamChat(
        {
          settings: titleSettings,
          messages: titleMessages,
          signal: AbortSignal.timeout(15000),
        },
        {
          onChunk: (delta) => {
            title += delta
          },
        },
      )
      if (title.trim()) return title.trim()
    }
  } catch {
    // fallback below
  }
  // Fallback: truncate user message
  return userMessage.length > 30 ? userMessage.slice(0, 30) + '...' : userMessage
}
