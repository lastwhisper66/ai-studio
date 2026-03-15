export interface Conversation {
  id: string
  title: string
  createdAt: string // ISO 8601
  updatedAt: string
  model: string | null
  systemPrompt: string | null
  assistantId: string | null
}

export interface Assistant {
  id: string
  name: string
  description: string
  systemPrompt: string
  providerId: string | null
  model: string
  temperature: string
  maxTokens: string
  promptSuggestions: string[]
  emoji: string
  sortOrder: number
  createdAt: string
  updatedAt: string
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

export type ProviderType =
  | 'openai'
  | 'azure'
  | 'deepseek'
  | 'gemini'
  | 'groq'
  | 'ollama'
  | 'silicon'
  | 'openrouter'
  | 'custom'

export interface Provider {
  id: string
  type: ProviderType
  name: string
  apiKey: string
  baseUrl: string
  model: string
  // Azure-specific
  endpoint: string
  apiVersion: string
  deploymentName: string
  // State
  enabled: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface ApiSettings {
  provider: ProviderType
  apiKey: string
  baseUrl: string
  model: string
  // Azure-specific
  endpoint: string
  apiVersion: string
  deploymentName: string
  // Global model params
  temperature: number
  maxTokens: number
  systemPrompt: string
}

export interface IpcResult<T> {
  success: boolean
  data?: T
  error?: string
}

/** chat:send-message request payload */
export interface SendMessagePayload {
  conversationId: string
}

/** chat:stream-chunk push data */
export interface StreamChunkData {
  conversationId: string
  delta: string
}

/** chat:stream-end push data */
export interface StreamEndData {
  conversationId: string
  message: Message | null
}

/** chat:stream-error push data */
export interface StreamErrorData {
  conversationId: string
  error: string
}

/** chat:title-updated push data */
export interface TitleUpdatedData {
  conversationId: string
  title: string
}
