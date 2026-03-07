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

export interface TestConnectionPayload {
  provider: ApiProvider
  apiKey: string
  baseUrl?: string
  endpoint?: string
  apiVersion?: string
  deploymentName?: string
  model: string
}
