import type { ApiProvider } from '@shared/types'

export interface SettingsFormState {
  provider: ApiProvider
  apiKey: string
  baseUrl: string
  endpoint: string
  apiVersion: string
  deploymentName: string
  model: string
  temperature: string
  maxTokens: string
  systemPrompt: string
}
