import OpenAI from 'openai'
import type { ApiSettings } from '@shared/types'
import { getSetting } from '../db/settings'
import { getProvider } from '../db/providers'
import { createOpenAIClient } from './openai-client'
import { createAzureClient } from './azure-client'

export function createAIClient(settings: ApiSettings): OpenAI {
  if (settings.provider === 'azure') {
    return createAzureClient(settings)
  }
  return createOpenAIClient(settings)
}

export function loadApiSettings(): ApiSettings {
  const activeProviderId = getSetting('active.providerId')
  if (!activeProviderId) {
    throw new Error(
      'No active provider configured. Please add and activate a provider in Settings.',
    )
  }

  const provider = getProvider(activeProviderId)
  if (!provider) {
    throw new Error('Active provider not found. Please select a provider in Settings.')
  }

  if (!provider.apiKey) {
    throw new Error(
      `API key is not configured for provider "${provider.name}". Please set your API key in Settings.`,
    )
  }

  // Global model params from settings table
  const temperature = parseFloat(getSetting('api.temperature') || '0.7')
  const maxTokens = parseInt(getSetting('api.maxTokens') || '4096', 10)
  const systemPrompt = getSetting('api.systemPrompt') || ''

  return {
    provider: provider.type,
    apiKey: provider.apiKey,
    baseUrl: provider.baseUrl,
    model: provider.model || 'gpt-4o',
    endpoint: provider.endpoint,
    apiVersion: provider.apiVersion,
    deploymentName: provider.deploymentName,
    temperature,
    maxTokens,
    systemPrompt,
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
