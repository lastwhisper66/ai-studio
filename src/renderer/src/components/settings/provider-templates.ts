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
    defaultBaseUrl: 'https://api.openai.com/v1',
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
    type: 'gemini',
    name: 'Google Gemini',
    color: '#4285f4',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModels: ['gemini-2.0-flash', 'gemini-2.5-pro'],
  },
  {
    type: 'groq',
    name: 'Groq',
    color: '#f55036',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    defaultModels: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
  },
  {
    type: 'ollama',
    name: 'Ollama',
    color: '#ffffff',
    defaultBaseUrl: 'http://localhost:11434/v1',
    defaultModels: ['llama3', 'qwen2.5'],
  },
  {
    type: 'silicon',
    name: 'Silicon Flow',
    color: '#6c5ce7',
    defaultBaseUrl: 'https://api.siliconflow.cn/v1',
    defaultModels: ['Qwen/Qwen2.5-72B-Instruct'],
  },
  {
    type: 'openrouter',
    name: 'OpenRouter',
    color: '#8b5cf6',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModels: ['openai/gpt-5.4'],
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
