export interface Conversation {
  id: string
  title: string
  createdAt: string // ISO 8601
  updatedAt: string
  systemPrompt: string | null
  assistantId: string | null
  pinned: boolean
}

export interface Assistant {
  id: string
  name: string
  description: string
  systemPrompt: string
  providerId: string | null
  model: string
  temperature: string
  maxCompletionTokens: string
  topP: string
  contextCount: string
  promptSuggestions: string[]
  isDefault: boolean
  group: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type MessageRole = 'user' | 'assistant' | 'system' | 'divider'

export interface Phrase {
  id: string
  title: string
  content: string
  sortOrder: number
  createdAt: string
}

export interface FileData {
  name: string
  mimeType: string
  base64: string
  size: number
}

/** Check whether a MIME type represents an image */
export function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

export interface AttachmentMeta {
  name: string
  mimeType: string
  path: string // relative path under data/attachments/
}

export interface Message {
  id: string
  conversationId: string
  role: MessageRole
  content: string
  reasoningContent: string | null
  createdAt: string
  tokenCount: number | null
  duration: number | null // response time in milliseconds
  thinkingDuration: number | null // reasoning phase duration in milliseconds
  attachments?: AttachmentMeta[]
}

export type ProviderType =
  | 'openai'
  | 'openai-response'
  | 'azure'
  | 'anthropic'
  | 'gemini'
  | 'claude'
  | 'deepseek'
  | 'silicon'
  | 'newapi'
  | 'fujitsu'

export interface Provider {
  id: string
  type: ProviderType
  name: string
  apiKey: string
  baseUrl: string
  enabled: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface CreateProviderPayload {
  type: ProviderType
  name: string
  apiKey?: string
  baseUrl?: string
  enabled?: boolean
  sortOrder?: number
}

export interface UpdateProviderPayload {
  name?: string
  apiKey?: string
  baseUrl?: string
  enabled?: boolean
  sortOrder?: number
}

export interface ProviderConnectionTestPayload {
  type: ProviderType
  apiKey: string
  baseUrl: string
  modelName: string
}

export interface RemoteModelFetchPayload {
  type: ProviderType
  apiKey: string
  baseUrl: string
}

export type ModelCapability =
  | 'reasoning'
  | 'vision'
  | 'web'
  | 'free'
  | 'embedding'
  | 'reranking'
  | 'tools'

export interface Model {
  id: string
  providerId: string
  name: string
  group: string
  capabilities: ModelCapability[]
  enabled: boolean
  sortOrder: number
  createdAt: string
}

export interface ModelDefinition {
  id: string
  name: string
  group: string
  capabilities: ModelCapability[]
  providerTypes: ProviderType[]
  createdAt: string
  updatedAt: string
}

export interface ModelGroup {
  id: string
  pattern: string
  displayName: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface ApiSettings {
  provider: ProviderType
  apiKey: string
  baseUrl: string
  model: string
  // Global model params
  temperature: number
  maxCompletionTokens: number
  topP: number
  systemPrompt: string
}

export interface IpcResult<T> {
  success: boolean
  data?: T
  error?: string
}

/** Reasoning effort level for models that support chain-of-thought */
export type ReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh'

/** chat:send-message request payload */
export interface SendMessagePayload {
  conversationId: string
  files?: FileData[]
  reasoningEffort?: ReasoningEffort
  /** When resending, the ID of the user message to resend from — context is truncated up to (inclusive) this message */
  resendMessageId?: string
}

/** chat:stream-chunk push data */
export interface StreamChunkData {
  conversationId: string
  delta: string
}

/** chat:stream-reasoning-chunk push data */
export interface StreamReasoningChunkData {
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

/** translate:request payload */
export interface TranslateRequestPayload {
  text: string
  sourceLang: string
  targetLang: string
  /** Override provider/model (independent of chat's global selection) */
  providerId?: string
  modelId?: string
  /** Custom system prompt for translation */
  systemPrompt?: string
  /** Custom temperature for translation (default 0.3) */
  temperature?: number
}

/** translate:chunk push data */
export interface TranslateChunkData {
  delta: string
}

/** translate:end push data */
export interface TranslateEndData {
  fullText: string
}

/** translate:error push data */
export interface TranslateErrorData {
  error: string
}

/** Translation history item */
export interface TranslationHistoryItem {
  id: string
  sourceText: string
  translatedText: string
  sourceLang: string
  targetLang: string
  createdAt: string
}
