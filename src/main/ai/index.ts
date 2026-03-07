import OpenAI from 'openai'
import type { ApiSettings, ApiProvider } from '@shared/types'
import { getAllSettings } from '../db/settings'
import { createOpenAIClient } from './openai-client'
import { createAzureClient } from './azure-client'

export function createAIClient(settings: ApiSettings): OpenAI {
  if (settings.provider === 'azure') {
    return createAzureClient(settings)
  }
  return createOpenAIClient(settings)
}

export function loadApiSettings(): ApiSettings {
  const all = getAllSettings()

  const provider = (all['api.provider'] as ApiProvider) || 'openai'
  const apiKey = all['api.apiKey'] || ''

  if (!apiKey) {
    throw new Error('API key is not configured. Please set your API key in Settings.')
  }

  return {
    provider,
    apiKey,
    baseUrl: all['api.baseUrl'] || undefined,
    endpoint: all['api.endpoint'] || undefined,
    apiVersion: all['api.apiVersion'] || undefined,
    deploymentName: all['api.deploymentName'] || undefined,
    model: all['api.model'] || 'gpt-4o',
    temperature: parseFloat(all['api.temperature'] || '0.7'),
    maxTokens: parseInt(all['api.maxTokens'] || '4096', 10),
    systemPrompt: all['api.systemPrompt'] || '',
  }
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
      max_tokens: 30,
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
