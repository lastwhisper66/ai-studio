import OpenAI from 'openai'
import type { ApiSettings } from '@shared/types'

export function createOpenAIClient(settings: ApiSettings): OpenAI {
  return new OpenAI({
    apiKey: settings.apiKey,
    baseURL: settings.baseUrl || undefined,
  })
}
