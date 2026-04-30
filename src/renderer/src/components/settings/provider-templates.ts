import type { ProviderType } from '@shared/types'

export interface ProviderTemplate {
  type: ProviderType
  name: string
  color: string
  defaultBaseUrl: string
}

export const PROVIDER_TEMPLATES: ProviderTemplate[] = [
  {
    type: 'openai',
    name: 'OpenAI',
    color: '#10a37f',
    defaultBaseUrl: 'https://api.openai.com',
  },
  {
    type: 'openai-response',
    name: 'OpenAI Response',
    color: '#0ea5e9',
    defaultBaseUrl: 'https://api.openai.com',
  },
  {
    type: 'azure',
    name: 'Azure OpenAI',
    color: '#0078d4',
    defaultBaseUrl: 'https://your-resource.openai.azure.com/openai/v1',
  },
  {
    type: 'gemini',
    name: 'Gemini',
    color: '#4285f4',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
  },
  {
    type: 'claude',
    name: 'Claude',
    color: '#d97757',
    defaultBaseUrl: 'https://api.anthropic.com',
  },
  {
    type: 'deepseek',
    name: 'DeepSeek',
    color: '#4d6bfe',
    defaultBaseUrl: 'https://api.deepseek.com',
  },
  {
    type: 'silicon',
    name: 'Silicon Flow',
    color: '#6c5ce7',
    defaultBaseUrl: 'https://api.siliconflow.cn',
  },
  {
    type: 'newapi',
    name: 'New API',
    color: '#f97316',
    defaultBaseUrl: '',
  },
  {
    type: 'fujitsu',
    name: 'Fujitsu Azure OpenAI',
    color: '#e60012',
    defaultBaseUrl: 'https://api.ai-service.global.fujitsu.com/ai-foundation/chat-ai/gpt',
  },
]

export function getTemplateByType(type: ProviderType): ProviderTemplate | undefined {
  return PROVIDER_TEMPLATES.find((t) => t.type === type)
}
