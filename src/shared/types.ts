import type { LocalizedError } from './errors'

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
  icon: string
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

export interface SaveFilePayload {
  base64: string
  defaultPath: string
  filters?: { name: string; extensions: string[] }[]
}

export interface ClipboardImagePayload {
  pngBase64: string
  html?: string
  text?: string
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
  toolCalls?: ToolCallData[]
  toolResults?: ToolCallResultData[]
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
  isDefault: boolean
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
  /** When omitted, the provider SDK's / model's default is used. */
  temperature?: number
  /** When omitted, the provider SDK's / model's default is used. */
  maxCompletionTokens?: number
  /** When omitted, the provider SDK's / model's default is used. */
  topP?: number
  systemPrompt: string
}

export interface IpcResult<T> {
  success: boolean
  data?: T
  error?: LocalizedError
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
  /** MCP resource contents to inject as context */
  resourceContext?: McpResourceContent[]
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
  error: LocalizedError
}

/** chat:title-updated push data */
export interface TitleUpdatedData {
  conversationId: string
  title: string
}

/** translate:request payload */
export interface TranslateRequestPayload {
  requestId: number
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
  requestId: number
  delta: string
}

/** translate:end push data */
export interface TranslateEndData {
  requestId: number
  fullText: string
}

/** translate:error push data */
export interface TranslateErrorData {
  requestId: number
  error: LocalizedError
}

// ── Quick Assistant ─────────────────────────────────────────────

export interface QuickAction {
  id: string
  name: string
  description: string
  systemPrompt: string
  icon: string
  isBuiltin: boolean
  sortOrder: number
  enabled: boolean
  createdAt: string
  updatedAt: string
}

/** quick-assistant:request payload */
export interface QuickActionRequestPayload {
  text: string
  actionId: string
  providerId?: string
  modelId?: string
  systemPromptOverride?: string
  files?: FileData[]
}

/** quick-assistant:chunk push data */
export interface QuickActionChunkData {
  delta: string
}

/** quick-assistant:end push data */
export interface QuickActionEndData {
  fullText: string
}

/** quick-assistant:error push data */
export interface QuickActionErrorData {
  error: LocalizedError
}

/** screenshot:data payload sent from main to renderer overlay */
export interface ScreenshotData {
  base64: string
  width: number
  height: number
  displayWidth: number
  displayHeight: number
  scaleFactor: number
}

/** screenshot:complete payload */
export interface ScreenshotCompletePayload {
  x: number
  y: number
  width: number
  height: number
}

/** quick-assistant:auto-execute payload */
export interface AutoExecutePayload {
  files: FileData[]
  actionId: string
  targetLang?: string
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

// ── Selection Assistant ─────────────────────────────────────────

export type SelectionTriggerMode = 'selected' | 'ctrlkey'

/** Default cap on selection text length, applied if the user hasn't customized it. */
export const DEFAULT_SELECTION_MAX_TEXT_LENGTH = 5000
/** Default floor; overridden by `selection.minTextLength` setting. */
export const DEFAULT_SELECTION_MIN_TEXT_LENGTH = 1

export const BUILTIN_SEARCH_ACTION_ID = 'builtin-sel-search'

/**
 * Anchor rectangle in DIP (device-independent pixels), describing the
 * on-screen selection region. Toolbar/bubble windows position themselves
 * relative to this rectangle.
 */
export interface SelectionAnchor {
  /** Left edge of the selection region (DIP) */
  x: number
  /** Top edge of the selection region (DIP) */
  y: number
  /** Width of the selection region (DIP); may be 0 when only a mouse point is known */
  width: number
  /** Height of the selection region (DIP); may be 0 when only a mouse point is known */
  height: number
  /** When true the toolbar should appear above the anchor instead of below. */
  preferTop?: boolean
}

/** Stored selection action — mirrors QuickAction */
export interface SelectionAction {
  id: string
  name: string
  description: string
  systemPrompt: string
  icon: string
  isBuiltin: boolean
  sortOrder: number
  enabled: boolean
  createdAt: string
  updatedAt: string
}

/** selection-toolbar:data push payload */
export interface SelectionToolbarPayload {
  text: string
  anchor: SelectionAnchor
  /** Enabled actions shown on the toolbar */
  actions: SelectionAction[]
}

/** selection-bubble:data push payload */
export interface SelectionBubblePayload {
  text: string
  anchor: SelectionAnchor
  actionId: string
  /** All enabled actions — used by the bubble's "switch action" menu */
  actions: SelectionAction[]
  /** Initial pinned state decided by main from `selection.defaultPinned`. */
  pinned: boolean
}

/** selection:request payload */
export interface SelectionRequestPayload {
  text: string
  actionId: string
  providerId?: string
  modelId?: string
  systemPromptOverride?: string
}

/** selection:chunk push data */
export interface SelectionChunkData {
  delta: string
}

/** selection:end push data */
export interface SelectionEndData {
  fullText: string
}

/** selection:error push data */
export interface SelectionErrorData {
  error: LocalizedError
}

// ── MCP (Model Context Protocol) ──────────────────────────────

export type McpServerType = 'stdio' | 'sse' | 'streamable-http'
export type McpServerStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface McpServer {
  id: string
  name: string
  type: McpServerType
  command: string
  args: string[]
  env: Record<string, string>
  url: string
  headers: Record<string, string>
  enabled: boolean
  autoApprove: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface McpTool {
  id: string
  serverId: string
  name: string
  description: string
  inputSchema: Record<string, unknown>
  enabled: boolean
}

export interface McpResource {
  uri: string
  name: string
  description?: string
  mimeType?: string
  serverId: string
  serverName: string
}

export interface McpResourceContent {
  uri: string
  mimeType?: string
  text?: string
  blob?: string
}

export interface McpResourceTemplate {
  uriTemplate: string
  name: string
  description?: string
  mimeType?: string
  serverId: string
}

export interface McpPromptArgument {
  name: string
  description?: string
  required?: boolean
}

export interface McpPrompt {
  name: string
  description?: string
  arguments?: McpPromptArgument[]
  serverId: string
  serverName: string
}

export interface McpPromptMessage {
  role: 'user' | 'assistant'
  content: {
    type: 'text' | 'image' | 'resource'
    text?: string
    data?: string
    mimeType?: string
    resource?: { uri: string; mimeType?: string; text?: string }
  }
}

export interface McpServerState {
  serverId: string
  status: McpServerStatus
  error?: string
  tools: McpTool[]
  resources: McpResource[]
  prompts: McpPrompt[]
}

export interface CreateMcpServerPayload {
  name: string
  type: McpServerType
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
  enabled?: boolean
  autoApprove?: boolean
}

export interface UpdateMcpServerPayload {
  name?: string
  type?: McpServerType
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
  enabled?: boolean
  autoApprove?: boolean
}

// ── Tool Calling ─────────────────────────────────────────────

export type ToolCallStatus = 'pending' | 'approved' | 'rejected' | 'running' | 'completed' | 'error'

export interface ToolCallData {
  id: string
  serverId: string
  serverName: string
  toolName: string
  arguments: Record<string, unknown>
  status: ToolCallStatus
  autoApprove: boolean
}

export interface ToolCallResultData {
  callId: string
  content: unknown[]
  isError: boolean
}

/** chat:tool-calls-requested push data */
export interface ToolCallsRequestedData {
  conversationId: string
  roundIndex: number
  toolCalls: ToolCallData[]
}

/** chat:tool-call-progress push data */
export interface ToolCallProgressData {
  conversationId: string
  callId: string
  status: ToolCallStatus
  result?: ToolCallResultData
}

/** chat:tool-call-approve invoke payload */
export interface ToolCallApprovalPayload {
  conversationId: string
  approvals: { callId: string; approved: boolean }[]
}

// ── Skills ──────────────────────────────────────────────────────

export interface Skill {
  id: string
  name: string
  description: string
  icon: string
  systemPrompt: string
  providerId: string | null
  model: string
  toolServerIds: string[]
  isBuiltin: boolean
  enabled: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface CreateSkillPayload {
  name: string
  description?: string
  icon?: string
  systemPrompt?: string
  providerId?: string | null
  model?: string
  toolServerIds?: string[]
  enabled?: boolean
  sortOrder?: number
}

export interface UpdateSkillPayload {
  name?: string
  description?: string
  icon?: string
  systemPrompt?: string
  providerId?: string | null
  model?: string
  toolServerIds?: string[]
  enabled?: boolean
  sortOrder?: number
}

// ── Tool Call Audit Log ─────────────────────────────────────────

export interface ToolCallAuditEntry {
  id: string
  conversationId: string
  serverId: string
  serverName: string
  toolName: string
  arguments: Record<string, unknown>
  result: unknown[] | null
  status: 'completed' | 'error' | 'rejected'
  isError: boolean
  durationMs: number | null
  roundIndex: number
  createdAt: string
}

export interface ToolCallAuditFilter {
  conversationId?: string
  serverId?: string
  toolName?: string
  status?: string
  startDate?: string
  endDate?: string
  limit?: number
  offset?: number
}
