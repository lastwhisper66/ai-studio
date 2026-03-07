import { AzureOpenAI } from 'openai'
import type { ApiSettings } from '@shared/types'

export function createAzureClient(settings: ApiSettings): AzureOpenAI {
  return new AzureOpenAI({
    apiKey: settings.apiKey,
    endpoint: settings.endpoint,
    apiVersion: settings.apiVersion || '2024-10-01-preview',
    deployment: settings.deploymentName,
  })
}
