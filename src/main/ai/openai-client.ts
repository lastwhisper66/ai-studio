import OpenAI from 'openai'
import type { ApiSettings } from '@shared/types'
import { normalizeBaseUrl } from '@shared/url'

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
}

export function createOpenAIClient(settings: ApiSettings): OpenAI {
  const baseURL = settings.baseUrl
    ? normalizeBaseUrl(settings.baseUrl, settings.provider)
    : undefined
  return new OpenAI({
    apiKey: settings.apiKey,
    baseURL,
    defaultHeaders: DEFAULT_HEADERS,
  })
}
