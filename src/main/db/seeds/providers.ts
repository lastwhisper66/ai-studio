import type { ProviderType } from '@shared/types'
import type { CreateProviderData } from '../providers'

export const DEFAULT_MODELS_BY_PROVIDER_TYPE: Partial<Record<ProviderType, readonly string[]>> = {
  fujitsu: ['gpt-5.1', 'gpt-5-mini'],
}

export const DEFAULT_PROVIDER_SEEDS: readonly CreateProviderData[] = [
  {
    type: 'fujitsu',
    name: 'Fujitsu Azure OpenAI',
    baseUrl: 'https://api.ai-service.global.fujitsu.com/ai-foundation/chat-ai/gpt',
    enabled: false,
  },
  { type: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com' },
  { type: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com' },
  { type: 'openai-response', name: 'OpenAI Response', baseUrl: 'https://api.openai.com' },
  { type: 'gemini', name: 'Gemini', baseUrl: 'https://generativelanguage.googleapis.com' },
  { type: 'claude', name: 'Claude', baseUrl: 'https://api.anthropic.com' },
  { type: 'silicon', name: 'Silicon Flow', baseUrl: 'https://api.siliconflow.cn' },
  { type: 'newapi', name: 'New API', baseUrl: 'https://api.example.com' },
  {
    type: 'azure',
    name: 'Azure OpenAI',
    baseUrl: 'https://your-resource.openai.azure.com/openai/v1',
  },
]
