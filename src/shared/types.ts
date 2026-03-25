export interface Conversation {
  id: string
  title: string
  createdAt: string // ISO 8601
  updatedAt: string
  providerId: string | null
  model: string | null
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
  createdAt: string
  tokenCount: number | null
  duration: number | null // response time in milliseconds
  attachments?: AttachmentMeta[]
}

export type ProviderType = 'openai' | 'azure' | 'deepseek' | 'silicon' | 'custom'

export interface Provider {
  id: string
  type: ProviderType
  name: string
  apiKey: string
  baseUrl: string
  model: string // deprecated — use models table instead
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
  maxCompletionTokens: number
  topP: number
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
  files?: FileData[]
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
