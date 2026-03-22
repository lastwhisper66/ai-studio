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
    defaultBaseUrl: '',
    defaultModels: ['gpt-5.1', 'GPT-5-mini'],
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
