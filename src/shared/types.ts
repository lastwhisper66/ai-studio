export interface Conversation {
  id: string
  title: string
  createdAt: string // ISO 8601
  updatedAt: string
  model: string | null
  systemPrompt: string | null
}

export type MessageRole = 'user' | 'assistant' | 'system'

export interface Message {
  id: string
  conversationId: string
  role: MessageRole
  content: string
  createdAt: string
  tokenCount: number | null
}

export type ApiProvider = 'openai' | 'azure'

export interface ApiSettings {
  provider: ApiProvider
  apiKey: string
  baseUrl?: string
  endpoint?: string
  apiVersion?: string
  deploymentName?: string
  model: string
  temperature: number
  maxTokens: number
  systemPrompt: string
}

export interface IpcResult<T> {
  success: boolean
  data?: T
  error?: string
}
