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

export type AssistantKind = 'assistant' | 'template'
export type AssistantSource = 'builtin' | 'user' | 'imported'

export interface Assistant {
  id: string
  kind: AssistantKind
  name: string
  icon: string
  description: string
  systemPrompt: string
  promptSuggestions: string[]

  // Instance fields (meaningful when kind='assistant')
  providerId: string | null
  model: string
  isDefault: boolean
  group: string

  // Template fields (meaningful when kind='template')
  category: string
  recommendedModel: string
  isBuiltin: boolean
  source: AssistantSource
  sourceTemplateId: string | null

  // Shared generation parameters
  temperature: string
  maxCompletionTokens: string
  topP: string
  contextCount: string

  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface ImportResolution {
  templateId: string
  action: 'skip' | 'overwrite' | 'asCopy'
}

export interface ConflictItem {
  /** Parsed template from the import file */
  template: Assistant
  /** ID of the existing template that conflicts */
  existingId: string
  /** Why it conflicts: `id` (same id) or `name` (different id, same name) */
  reason: 'id' | 'name'
}

export interface ImportPlan {
  ok: Assistant[]
  conflicts: ConflictItem[]
}

export interface ImportResult {
  imported: number
  skipped: number
  overwritten: number
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

// ── Auto Updater ────────────────────────────────────────────────

export type UpdaterStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface UpdaterDownloadProgress {
  percent: number
  transferred: number
  total: number
  bytesPerSecond: number
}

export interface AppReleaseInfo {
  version: string
  name?: string
  notes: string
  url: string
  publishedAt?: string
}

export interface UpdaterState {
  status: UpdaterStatus
  currentVersion: string
  latestVersion?: string
  releaseNotes?: string
  releaseUrl?: string
  downloadProgress?: UpdaterDownloadProgress
  error?: string
  /** true when running on macOS without a signed build — UI should show "open download page" instead of "download now". */
  isMacFallback: boolean
  /** true when the user explicitly triggered a check (vs silent startup check); controls whether "already up to date" UI is shown. */
  manualCheck?: boolean
}

// =============================================================================
// Backup & Cloud Sync
// =============================================================================

/** Plain (decrypted) snapshot of all "config-like" data. */
export interface BackupSnapshot {
  schemaVersion: 1
  exportedAt: string
  app: { version: string }
  /** All settings.* keys, with safeStorage-encrypted values already decrypted to plaintext. */
  settings: Record<string, string>
  /** Provider rows with `apiKey` already decrypted. */
  providers: Provider[]
  models: Model[]
  modelDefinitions: ModelDefinition[]
  modelGroups: ModelGroup[]
  assistants: Assistant[]
  phrases: Phrase[]
  quickActions: QuickAction[]
  selectionActions: SelectionAction[]
  avatars: BackupAvatar[]
}

export interface BackupAvatar {
  fileName: string
  mimeType: string
  /** base64 encoded file content. */
  data: string
}

export interface BackupSummary {
  providers: number
  models: number
  assistants: number
  phrases: number
  quickActions: number
  selectionActions: number
  modelDefinitions: number
  modelGroups: number
  settings: number
  avatars: number
}

/** Metadata embedded in the plaintext header of the .aibackup file. */
export interface BackupFileMeta {
  schemaVersion: 1
  appVersion: string
  createdAt: string
}

export type BackupImportMode = 'replace' | 'merge'

export interface WebDavRemoteConfig {
  type: 'webdav'
  url: string
  username: string
  password: string
  subPath: string
}

export interface S3RemoteConfig {
  type: 's3'
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  forcePathStyle: boolean
  prefix: string
}

/**
 * Discriminated union for a single remote config — used by `testRemote` and
 * the per-type save/clear IPC payloads. Persisted shape is `RemoteConfigs`
 * (plural), which allows WebDAV and S3 to be configured simultaneously and
 * have the sync-engine mirror writes to both.
 */
export type RemoteConfig = WebDavRemoteConfig | S3RemoteConfig

/** Both remotes can be configured at once; either may be null when not set. */
export interface RemoteConfigs {
  webdav: WebDavRemoteConfig | null
  s3: S3RemoteConfig | null
}

/** Discriminator used by per-type IPC payloads (set / clear / list / restore). */
export type RemoteType = 'webdav' | 's3'

export interface RemoteSyncStatus {
  type: RemoteType
  /** Whether credentials are saved (not whether sync is enabled). */
  configured: boolean
  /** User-controlled enable switch. */
  enabled: boolean
  isSyncing: boolean
  lastSyncedAt: string | null
  lastRemoteSeenAt: string | null
  lastError: LocalizedError | null
  lastWarning: string | null
  autoSyncIntervalMinutes: number
  maxRetainedBackups: number
}

export interface BackupStatus {
  /** Local DB change timestamp; the only field still global since local data is one. */
  lastLocalChangeAt: string | null
  remotes: {
    webdav: RemoteSyncStatus
    s3: RemoteSyncStatus
  }
}

export interface SyncResult {
  direction: 'upload' | 'download' | 'cancelled'
  /** ISO timestamp of the backup that became authoritative this round (when applicable). */
  createdAt?: string
}

export interface RemoteBackupItem {
  /** Object key relative to the remote root (e.g. `backups/2026-05-03T12-34-56-789Z.aibackup`). */
  key: string
  size: number
  /** Last-modified time reported by the remote. */
  lastModified: string
  /** `createdAt` parsed from the .aibackup plaintext header (or, if unavailable, derived from the key). */
  createdAt: string
  appVersion: string
  /** Which remote this entry came from. */
  remoteType: RemoteType
}

/**
 * Local pre-apply rollback snapshot (lives under
 * `<dataDir>/backups/auto-rollback/`). Written every time the sync-service
 * is about to overwrite local DB; the user can recover from one if a
 * cloud-applied state turns out to be wrong.
 */
export interface RollbackBackupItem {
  /** Absolute path on disk; passed back to `importFromFile` to restore. */
  filePath: string
  /** File name (without directory) — useful for keying lists. */
  fileName: string
  /** ISO timestamp parsed from the file name; falls back to mtime. */
  createdAt: string
  size: number
  /** Which event produced this rollback copy. `'manual'` covers cases where
   *  `writePreApplyRollback` was called outside an automatic cloud apply. */
  triggeredBy: RemoteType | 'manual'
}

export type BackupPhase =
  | 'collect'
  | 'encrypt'
  | 'upload'
  | 'download'
  | 'decrypt'
  | 'apply'
  | 'cleanup'

export interface BackupProgress {
  /** Which remote is producing this progress event. Absent for legacy paths
   *  (e.g. file export/import) that aren't tied to a single remote — those
   *  callers may pass `'local'`. */
  type: RemoteType | 'local'
  phase: BackupPhase
  /** 0–100; absent for indeterminate phases. */
  percent?: number
}

// ── Builtin presets (assistant templates / quick & selection actions) ────────
export type BuiltinCategory = 'templates' | 'quickActions' | 'selectionActions'

export interface BuiltinCategoryStatus {
  hasUpdate: boolean
  currentVersion: number
  appliedVersion: number
}

export interface BuiltinUpdatesStatus {
  templates: BuiltinCategoryStatus
  quickActions: BuiltinCategoryStatus
  selectionActions: BuiltinCategoryStatus
}
