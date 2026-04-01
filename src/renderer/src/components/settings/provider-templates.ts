import type { ProviderType } from '@shared/types'

export interface ProviderTemplate {
  type: ProviderType
  name: string
  color: string
  defaultBaseUrl: string
  defaultModels: string[]
}

export const PROVIDER_TEMPLATES: ProviderTemplate[] = [
  {
    type: 'openai',
    name: 'OpenAI',
    color: '#10a37f',
    defaultBaseUrl: 'https://api.openai.com',
    defaultModels: ['gpt-5.4', 'gpt-5.3-codex'],
  },
  {
    type: 'azure',
    name: 'Azure OpenAI',
    color: '#0078d4',
    defaultBaseUrl: 'https://your-resource.openai.azure.com/openai/v1',
    defaultModels: ['gpt-4o', 'gpt-4o-mini'],
  },
  {
    type: 'deepseek',
    name: 'DeepSeek',
    color: '#4d6bfe',
    defaultBaseUrl: 'https://api.deepseek.com',
    defaultModels: ['deepseek-chat', 'deepseek-reasoner'],
  },
  {
    type: 'silicon',
    name: 'Silicon Flow',
    color: '#6c5ce7',
    defaultBaseUrl: 'https://api.siliconflow.cn',
    defaultModels: [
      'Pro/deepseek-ai/DeepSeek-V3.2',
      'Pro/MiniMaxAI/MiniMax-M2.5',
      'Pro/zai-org/GLM-5',
      'deepseek-ai/DeepSeek-V3.2',
    ],
  },
  {
    type: 'newapi',
    name: 'New API',
    color: '#f97316',
    defaultBaseUrl: '',
    defaultModels: [],
  },
  {
    type: 'custom',
    name: 'OpenAI Compatible',
    color: '#6b7280',
    defaultBaseUrl: '',
    defaultModels: [],
  },
]

export function getTemplateByType(type: ProviderType): ProviderTemplate | undefined {
  return PROVIDER_TEMPLATES.find((t) => t.type === type)
}
