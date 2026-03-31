import OpenAI from 'openai'
import type { ApiSettings } from '@shared/types'
import { getSetting } from '../db/settings'
import { createOpenAIClient } from './openai-client'
import { createAzureClient } from './azure-client'

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
  if (settings.provider === 'azure') {
    return createAzureClient(settings)
  }
  return createOpenAIClient(settings)
}

export async function generateTitle(
  client: OpenAI,
  model: string,
  userMessage: string,
  assistantMessage: string,
): Promise<string> {
  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content:
            'Generate a concise title (6 words or less) for this conversation. Return only the title, no quotes or punctuation.',
        },
        { role: 'user', content: userMessage },
        { role: 'assistant', content: assistantMessage.slice(0, 500) },
      ],
      max_completion_tokens: 30,
      temperature: 0.5,
    })
    const title = response.choices[0]?.message?.content?.trim()
    if (title) return title
  } catch {
    // fallback below
  }
  // Fallback: truncate user message
  return userMessage.length > 30 ? userMessage.slice(0, 30) + '...' : userMessage
}
