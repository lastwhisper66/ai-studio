import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IpcChannels } from '@shared/ipc-channels'
import type {
  Conversation,
  Message,
  MessageRole,
  IpcResult,
  SendMessagePayload,
  StreamChunkData,
  StreamReasoningChunkData,
  StreamEndData,
  StreamErrorData,
  TitleUpdatedData,
  Provider,
  CreateProviderPayload,
  UpdateProviderPayload,
  ProviderConnectionTestPayload,
  RemoteModelFetchPayload,
  Model,
  ModelDefinition,
  ModelGroup,
  Assistant,
  Phrase,
  FileData,
  SaveFilePayload,
  ClipboardImagePayload,
  TranslateRequestPayload,
  TranslateChunkData,
  TranslateEndData,
  TranslateErrorData,
  ModelCapability,
  TranslationHistoryItem,
  QuickAction,
  QuickActionRequestPayload,
  QuickActionChunkData,
  QuickActionEndData,
  QuickActionErrorData,
  ScreenshotCompletePayload,
  ScreenshotData,
  AutoExecutePayload,
  SelectionToolbarPayload,
  SelectionBubblePayload,
  SelectionAction,
  SelectionRequestPayload,
  SelectionChunkData,
  SelectionEndData,
  SelectionErrorData,
  AppReleaseInfo,
  UpdaterState,
  BackupFileMeta,
  BackupImportMode,
  BackupProgress,
  BackupStatus,
  BackupSummary,
  RemoteBackupItem,
  RemoteConfig,
  RemoteConfigs,
  RemoteType,
  RollbackBackupItem,
  SyncResult,
} from '@shared/types'

// Custom APIs for renderer — typed IPC wrappers
const api = {
  // Conversations
  listConversations: (): Promise<IpcResult<Conversation[]>> =>
    ipcRenderer.invoke(IpcChannels.CONVERSATION_LIST),

  getConversation: (id: string): Promise<IpcResult<Conversation | undefined>> =>
    ipcRenderer.invoke(IpcChannels.CONVERSATION_GET, id),

  createConversation: (title?: string, assistantId?: string): Promise<IpcResult<Conversation>> =>
    ipcRenderer.invoke(IpcChannels.CONVERSATION_CREATE, title, assistantId),

  updateConversation: (
    id: string,
    data: Partial<Pick<Conversation, 'title' | 'systemPrompt' | 'pinned'>>,
  ): Promise<IpcResult<Conversation | undefined>> =>
    ipcRenderer.invoke(IpcChannels.CONVERSATION_UPDATE, id, data),

  deleteConversation: (id: string): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.CONVERSATION_DELETE, id),

  deleteConversations: (ids: string[]): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.CONVERSATION_DELETE_MANY, ids),

  // Messages
  listMessages: (conversationId: string): Promise<IpcResult<Message[]>> =>
    ipcRenderer.invoke(IpcChannels.MESSAGE_LIST, conversationId),

  listMessagesPaginated: (
    conversationId: string,
    limit?: number,
    beforeCreatedAt?: string,
  ): Promise<IpcResult<{ messages: Message[]; hasMore: boolean }>> =>
    ipcRenderer.invoke(IpcChannels.MESSAGE_LIST_PAGINATED, conversationId, limit, beforeCreatedAt),

  createMessage: (
    conversationId: string,
    role: MessageRole,
    content: string,
    files?: FileData[],
  ): Promise<IpcResult<Message>> =>
    ipcRenderer.invoke(IpcChannels.MESSAGE_CREATE, conversationId, role, content, files),

  deleteMessage: (id: string): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.MESSAGE_DELETE, id),

  updateMessage: (id: string, content: string): Promise<IpcResult<Message>> =>
    ipcRenderer.invoke(IpcChannels.MESSAGE_UPDATE, id, content),

  clearMessages: (conversationId: string): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.MESSAGE_CLEAR, conversationId),

  insertDivider: (conversationId: string): Promise<IpcResult<Message>> =>
    ipcRenderer.invoke(IpcChannels.MESSAGE_INSERT_DIVIDER, conversationId),

  // Phrases
  listPhrases: (): Promise<IpcResult<Phrase[]>> => ipcRenderer.invoke(IpcChannels.PHRASE_LIST),

  createPhrase: (title: string, content: string): Promise<IpcResult<Phrase>> =>
    ipcRenderer.invoke(IpcChannels.PHRASE_CREATE, title, content),

  updatePhrase: (
    id: string,
    data: Partial<Pick<Phrase, 'title' | 'content'>>,
  ): Promise<IpcResult<Phrase | undefined>> =>
    ipcRenderer.invoke(IpcChannels.PHRASE_UPDATE, id, data),

  deletePhrase: (id: string): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.PHRASE_DELETE, id),

  // File
  openFileDialog: (): Promise<IpcResult<FileData[]>> =>
    ipcRenderer.invoke(IpcChannels.FILE_OPEN_DIALOG),

  saveFile: (payload: SaveFilePayload): Promise<IpcResult<boolean>> =>
    ipcRenderer.invoke(IpcChannels.FILE_SAVE, payload),

  readAttachment: (relativePath: string): Promise<IpcResult<string>> =>
    ipcRenderer.invoke(IpcChannels.ATTACHMENT_READ, relativePath),

  // Settings
  getSetting: (key: string): Promise<IpcResult<string | undefined>> =>
    ipcRenderer.invoke(IpcChannels.SETTINGS_GET, key),

  setSetting: (key: string, value: string): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.SETTINGS_SET, key, value),

  getAllSettings: (): Promise<IpcResult<Record<string, string>>> =>
    ipcRenderer.invoke(IpcChannels.SETTINGS_GET_ALL),

  setSettingsBatch: (entries: Record<string, string>): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.SETTINGS_SET_BATCH, entries),

  onLanguageChanged: (callback: (lang: string) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, lang: string): void => callback(lang)
    ipcRenderer.on(IpcChannels.SETTINGS_LANGUAGE_CHANGED, handler)
    return () => ipcRenderer.removeListener(IpcChannels.SETTINGS_LANGUAGE_CHANGED, handler)
  },

  onSettingsChanged: (callback: (entries: Record<string, string>) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, entries: Record<string, string>): void =>
      callback(entries)
    ipcRenderer.on(IpcChannels.SETTINGS_CHANGED, handler)
    return () => ipcRenderer.removeListener(IpcChannels.SETTINGS_CHANGED, handler)
  },

  // Providers
  listProviders: (): Promise<IpcResult<Provider[]>> =>
    ipcRenderer.invoke(IpcChannels.PROVIDER_LIST),

  getProvider: (id: string): Promise<IpcResult<Provider | undefined>> =>
    ipcRenderer.invoke(IpcChannels.PROVIDER_GET, id),

  createProvider: (data: CreateProviderPayload): Promise<IpcResult<Provider>> =>
    ipcRenderer.invoke(IpcChannels.PROVIDER_CREATE, data),

  updateProvider: (
    id: string,
    data: UpdateProviderPayload,
  ): Promise<IpcResult<Provider | undefined>> =>
    ipcRenderer.invoke(IpcChannels.PROVIDER_UPDATE, id, data),

  deleteProvider: (id: string): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.PROVIDER_DELETE, id),

  reorderProviders: (ids: string[]): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.PROVIDER_REORDER, ids),

  testProviderConnection: (payload: ProviderConnectionTestPayload): Promise<IpcResult<string>> =>
    ipcRenderer.invoke(IpcChannels.PROVIDER_TEST_CONNECTION, payload),

  // Models
  listModels: (): Promise<IpcResult<Model[]>> => ipcRenderer.invoke(IpcChannels.MODEL_LIST),

  createModel: (data: {
    providerId: string
    name: string
    group?: string
    capabilities?: ModelCapability[]
  }): Promise<IpcResult<Model>> => ipcRenderer.invoke(IpcChannels.MODEL_CREATE, data),

  updateModel: (id: string, data: Partial<Model>): Promise<IpcResult<Model | undefined>> =>
    ipcRenderer.invoke(IpcChannels.MODEL_UPDATE, id, data),

  deleteModel: (id: string): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.MODEL_DELETE, id),

  deleteModelsByProvider: (providerId: string): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.MODEL_DELETE_BY_PROVIDER, providerId),

  reorderModels: (ids: string[]): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.MODEL_REORDER, ids),

  fetchRemoteModels: (
    payload: RemoteModelFetchPayload,
  ): Promise<
    IpcResult<
      {
        id: string
        owned_by?: string
      }[]
    >
  > => ipcRenderer.invoke(IpcChannels.MODEL_FETCH_REMOTE, payload),

  // Model Definitions (global capability library)
  listModelDefinitions: (): Promise<IpcResult<ModelDefinition[]>> =>
    ipcRenderer.invoke(IpcChannels.MODEL_DEFINITION_LIST),

  createModelDefinition: (data: {
    name: string
    group?: string
    capabilities?: ModelCapability[]
  }): Promise<IpcResult<ModelDefinition>> =>
    ipcRenderer.invoke(IpcChannels.MODEL_DEFINITION_CREATE, data),

  updateModelDefinition: (
    id: string,
    data: { name?: string; group?: string; capabilities?: ModelCapability[] },
  ): Promise<IpcResult<ModelDefinition | undefined>> =>
    ipcRenderer.invoke(IpcChannels.MODEL_DEFINITION_UPDATE, id, data),

  deleteModelDefinition: (id: string): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.MODEL_DEFINITION_DELETE, id),

  // Model Groups (grouping rules for remote models)
  listModelGroups: (): Promise<IpcResult<ModelGroup[]>> =>
    ipcRenderer.invoke(IpcChannels.MODEL_GROUP_LIST),

  createModelGroup: (data: {
    pattern: string
    displayName: string
    sortOrder?: number
  }): Promise<IpcResult<ModelGroup>> => ipcRenderer.invoke(IpcChannels.MODEL_GROUP_CREATE, data),

  updateModelGroup: (
    id: string,
    data: { pattern?: string; displayName?: string; sortOrder?: number },
  ): Promise<IpcResult<ModelGroup | undefined>> =>
    ipcRenderer.invoke(IpcChannels.MODEL_GROUP_UPDATE, id, data),

  deleteModelGroup: (id: string): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.MODEL_GROUP_DELETE, id),

  // Assistants
  listAssistants: (): Promise<IpcResult<Assistant[]>> =>
    ipcRenderer.invoke(IpcChannels.ASSISTANT_LIST),

  getAssistant: (id: string): Promise<IpcResult<Assistant | undefined>> =>
    ipcRenderer.invoke(IpcChannels.ASSISTANT_GET, id),

  createAssistant: (data: Partial<Assistant> & { name: string }): Promise<IpcResult<Assistant>> =>
    ipcRenderer.invoke(IpcChannels.ASSISTANT_CREATE, data),

  updateAssistant: (
    id: string,
    data: Partial<Assistant>,
  ): Promise<IpcResult<Assistant | undefined>> =>
    ipcRenderer.invoke(IpcChannels.ASSISTANT_UPDATE, id, data),

  deleteAssistant: (id: string): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.ASSISTANT_DELETE, id),

  reorderAssistants: (ids: string[]): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.ASSISTANT_REORDER, ids),

  // Chat (streaming)
  sendMessage: (payload: SendMessagePayload): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.CHAT_SEND_MESSAGE, payload),

  stopGeneration: (conversationId: string): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.CHAT_STOP_GENERATION, conversationId),

  onStreamChunk: (callback: (data: StreamChunkData) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: StreamChunkData): void => callback(data)
    ipcRenderer.on(IpcChannels.CHAT_STREAM_CHUNK, handler)
    return () => ipcRenderer.removeListener(IpcChannels.CHAT_STREAM_CHUNK, handler)
  },

  onStreamReasoningChunk: (callback: (data: StreamReasoningChunkData) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: StreamReasoningChunkData): void =>
      callback(data)
    ipcRenderer.on(IpcChannels.CHAT_STREAM_REASONING_CHUNK, handler)
    return () => ipcRenderer.removeListener(IpcChannels.CHAT_STREAM_REASONING_CHUNK, handler)
  },

  onStreamEnd: (callback: (data: StreamEndData) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: StreamEndData): void => callback(data)
    ipcRenderer.on(IpcChannels.CHAT_STREAM_END, handler)
    return () => ipcRenderer.removeListener(IpcChannels.CHAT_STREAM_END, handler)
  },

  onStreamError: (callback: (data: StreamErrorData) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: StreamErrorData): void => callback(data)
    ipcRenderer.on(IpcChannels.CHAT_STREAM_ERROR, handler)
    return () => ipcRenderer.removeListener(IpcChannels.CHAT_STREAM_ERROR, handler)
  },

  onTitleUpdated: (callback: (data: TitleUpdatedData) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: TitleUpdatedData): void => callback(data)
    ipcRenderer.on(IpcChannels.CHAT_TITLE_UPDATED, handler)
    return () => ipcRenderer.removeListener(IpcChannels.CHAT_TITLE_UPDATED, handler)
  },

  removeAllStreamListeners: (): void => {
    ipcRenderer.removeAllListeners(IpcChannels.CHAT_STREAM_CHUNK)
    ipcRenderer.removeAllListeners(IpcChannels.CHAT_STREAM_REASONING_CHUNK)
    ipcRenderer.removeAllListeners(IpcChannels.CHAT_STREAM_END)
    ipcRenderer.removeAllListeners(IpcChannels.CHAT_STREAM_ERROR)
    ipcRenderer.removeAllListeners(IpcChannels.CHAT_TITLE_UPDATED)
  },

  // Translate (streaming)
  translate: (payload: TranslateRequestPayload): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.TRANSLATE_REQUEST, payload),

  stopTranslation: (): Promise<IpcResult<void>> => ipcRenderer.invoke(IpcChannels.TRANSLATE_STOP),

  onTranslateChunk: (callback: (data: TranslateChunkData) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: TranslateChunkData): void =>
      callback(data)
    ipcRenderer.on(IpcChannels.TRANSLATE_CHUNK, handler)
    return () => ipcRenderer.removeListener(IpcChannels.TRANSLATE_CHUNK, handler)
  },

  onTranslateEnd: (callback: (data: TranslateEndData) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: TranslateEndData): void => callback(data)
    ipcRenderer.on(IpcChannels.TRANSLATE_END, handler)
    return () => ipcRenderer.removeListener(IpcChannels.TRANSLATE_END, handler)
  },

  onTranslateError: (callback: (data: TranslateErrorData) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: TranslateErrorData): void =>
      callback(data)
    ipcRenderer.on(IpcChannels.TRANSLATE_ERROR, handler)
    return () => ipcRenderer.removeListener(IpcChannels.TRANSLATE_ERROR, handler)
  },

  removeAllTranslateListeners: (): void => {
    ipcRenderer.removeAllListeners(IpcChannels.TRANSLATE_CHUNK)
    ipcRenderer.removeAllListeners(IpcChannels.TRANSLATE_END)
    ipcRenderer.removeAllListeners(IpcChannels.TRANSLATE_ERROR)
  },

  // Translation History
  listTranslationHistory: (): Promise<IpcResult<TranslationHistoryItem[]>> =>
    ipcRenderer.invoke(IpcChannels.TRANSLATION_HISTORY_LIST),

  createTranslationHistory: (
    sourceText: string,
    translatedText: string,
    sourceLang: string,
    targetLang: string,
  ): Promise<IpcResult<TranslationHistoryItem>> =>
    ipcRenderer.invoke(
      IpcChannels.TRANSLATION_HISTORY_CREATE,
      sourceText,
      translatedText,
      sourceLang,
      targetLang,
    ),

  clearTranslationHistory: (): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.TRANSLATION_HISTORY_CLEAR),

  // App
  clearAppData: (): Promise<IpcResult<void>> => ipcRenderer.invoke(IpcChannels.APP_CLEAR_DATA),

  copyPngToClipboard: (payload: ClipboardImagePayload): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.CLIPBOARD_WRITE_IMAGE, payload),

  getSystemFonts: (): Promise<IpcResult<string[]>> => ipcRenderer.invoke(IpcChannels.APP_GET_FONTS),

  openProjectPage: (): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.APP_OPEN_PROJECT_PAGE),

  openReleasesPage: (): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.APP_OPEN_RELEASES_PAGE),

  getLatestRelease: (): Promise<IpcResult<AppReleaseInfo>> =>
    ipcRenderer.invoke(IpcChannels.APP_GET_LATEST_RELEASE),

  // Zoom
  setZoom: (factor: number): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.WINDOW_SET_ZOOM, factor),

  getZoom: (): Promise<number> => ipcRenderer.invoke(IpcChannels.WINDOW_GET_ZOOM),

  onZoomChanged: (callback: (factor: number) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, factor: number): void => callback(factor)
    ipcRenderer.on(IpcChannels.WINDOW_ZOOM_CHANGED, handler)
    return () => ipcRenderer.removeListener(IpcChannels.WINDOW_ZOOM_CHANGED, handler)
  },

  // Window controls
  windowMinimize: (): Promise<void> => ipcRenderer.invoke(IpcChannels.WINDOW_MINIMIZE),

  windowMaximize: (): Promise<void> => ipcRenderer.invoke(IpcChannels.WINDOW_MAXIMIZE),

  windowClose: (): void => ipcRenderer.send(IpcChannels.WINDOW_CLOSE),

  windowIsMaximized: (): Promise<boolean> => ipcRenderer.invoke(IpcChannels.WINDOW_IS_MAXIMIZED),

  onWindowMaximizedChange: (callback: (isMaximized: boolean) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, isMaximized: boolean): void =>
      callback(isMaximized)
    ipcRenderer.on(IpcChannels.WINDOW_MAXIMIZED_CHANGE, handler)
    return () => ipcRenderer.removeListener(IpcChannels.WINDOW_MAXIMIZED_CHANGE, handler)
  },

  windowToggleAlwaysOnTop: (): Promise<boolean> =>
    ipcRenderer.invoke(IpcChannels.WINDOW_TOGGLE_ALWAYS_ON_TOP),

  windowIsAlwaysOnTop: (): Promise<boolean> =>
    ipcRenderer.invoke(IpcChannels.WINDOW_IS_ALWAYS_ON_TOP),

  onWindowAlwaysOnTopChange: (callback: (isAlwaysOnTop: boolean) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, isAlwaysOnTop: boolean): void =>
      callback(isAlwaysOnTop)
    ipcRenderer.on(IpcChannels.WINDOW_ALWAYS_ON_TOP_CHANGE, handler)
    return () => ipcRenderer.removeListener(IpcChannels.WINDOW_ALWAYS_ON_TOP_CHANGE, handler)
  },

  // Quick Actions (CRUD)
  listQuickActions: (): Promise<IpcResult<QuickAction[]>> =>
    ipcRenderer.invoke(IpcChannels.QUICK_ACTION_LIST),

  createQuickAction: (data: {
    name: string
    description?: string
    systemPrompt?: string
    icon?: string
  }): Promise<IpcResult<QuickAction>> => ipcRenderer.invoke(IpcChannels.QUICK_ACTION_CREATE, data),

  updateQuickAction: (
    id: string,
    data: Partial<Pick<QuickAction, 'name' | 'description' | 'systemPrompt' | 'icon' | 'enabled'>>,
  ): Promise<IpcResult<QuickAction | undefined>> =>
    ipcRenderer.invoke(IpcChannels.QUICK_ACTION_UPDATE, id, data),

  deleteQuickAction: (id: string): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.QUICK_ACTION_DELETE, id),

  reorderQuickActions: (ids: string[]): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.QUICK_ACTION_REORDER, ids),

  // Quick Assistant (streaming)
  quickAssistantRequest: (payload: QuickActionRequestPayload): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.QUICK_ASSISTANT_REQUEST, payload),

  stopQuickAssistant: (): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.QUICK_ASSISTANT_STOP),

  onQuickAssistantChunk: (callback: (data: QuickActionChunkData) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: QuickActionChunkData): void =>
      callback(data)
    ipcRenderer.on(IpcChannels.QUICK_ASSISTANT_CHUNK, handler)
    return () => ipcRenderer.removeListener(IpcChannels.QUICK_ASSISTANT_CHUNK, handler)
  },

  onQuickAssistantEnd: (callback: (data: QuickActionEndData) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: QuickActionEndData): void =>
      callback(data)
    ipcRenderer.on(IpcChannels.QUICK_ASSISTANT_END, handler)
    return () => ipcRenderer.removeListener(IpcChannels.QUICK_ASSISTANT_END, handler)
  },

  onQuickAssistantError: (callback: (data: QuickActionErrorData) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: QuickActionErrorData): void =>
      callback(data)
    ipcRenderer.on(IpcChannels.QUICK_ASSISTANT_ERROR, handler)
    return () => ipcRenderer.removeListener(IpcChannels.QUICK_ASSISTANT_ERROR, handler)
  },

  removeAllQuickAssistantListeners: (): void => {
    ipcRenderer.removeAllListeners(IpcChannels.QUICK_ASSISTANT_CHUNK)
    ipcRenderer.removeAllListeners(IpcChannels.QUICK_ASSISTANT_END)
    ipcRenderer.removeAllListeners(IpcChannels.QUICK_ASSISTANT_ERROR)
  },

  closeQuickAssistant: (): void => ipcRenderer.send(IpcChannels.QUICK_ASSISTANT_CLOSE),

  quickAssistantReady: (): void => ipcRenderer.send(IpcChannels.QUICK_ASSISTANT_READY),

  setQuickAssistantPinned: (pinned: boolean): void =>
    ipcRenderer.send(IpcChannels.QUICK_ASSISTANT_SET_PINNED, pinned),

  onQuickAssistantStateChanged: (callback: (state: { pinned: boolean }) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, state: { pinned: boolean }): void =>
      callback(state)
    ipcRenderer.on(IpcChannels.QUICK_ASSISTANT_STATE_CHANGED, handler)
    return () => {
      ipcRenderer.removeListener(IpcChannels.QUICK_ASSISTANT_STATE_CHANGED, handler)
    }
  },

  updateQuickAssistantShortcut: (): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.QUICK_ASSISTANT_UPDATE_SHORTCUT),

  updateSummonWindowShortcut: (): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.SUMMON_WINDOW_UPDATE_SHORTCUT),

  // Screenshot
  onScreenshotData: (callback: (data: ScreenshotData) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: ScreenshotData): void => callback(data)
    ipcRenderer.on(IpcChannels.SCREENSHOT_DATA, handler)
    return () => ipcRenderer.removeListener(IpcChannels.SCREENSHOT_DATA, handler)
  },

  screenshotComplete: (rect: ScreenshotCompletePayload): void =>
    ipcRenderer.send(IpcChannels.SCREENSHOT_COMPLETE, rect),

  screenshotCancel: (): void => ipcRenderer.send(IpcChannels.SCREENSHOT_CANCEL),

  updateScreenshotShortcut: (): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.SCREENSHOT_UPDATE_SHORTCUT),

  // Quick Assistant auto-execute (pull model — renderer pulls pending payload)
  getPendingAutoExecute: (): Promise<IpcResult<AutoExecutePayload | null>> =>
    ipcRenderer.invoke(IpcChannels.QUICK_ASSISTANT_GET_PENDING_AUTO_EXECUTE),

  // Selection Assistant — toolbar window
  selectionToolbarReady: (): void => ipcRenderer.send(IpcChannels.SELECTION_TOOLBAR_READY),

  onSelectionToolbarData: (callback: (data: SelectionToolbarPayload) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: SelectionToolbarPayload): void =>
      callback(data)
    ipcRenderer.on(IpcChannels.SELECTION_TOOLBAR_DATA, handler)
    return () => ipcRenderer.removeListener(IpcChannels.SELECTION_TOOLBAR_DATA, handler)
  },

  selectionToolbarAction: (actionId: string): void =>
    ipcRenderer.send(IpcChannels.SELECTION_TOOLBAR_ACTION, actionId),

  selectionToolbarClose: (): void => ipcRenderer.send(IpcChannels.SELECTION_TOOLBAR_CLOSE),

  selectionToolbarResize: (width: number): void =>
    ipcRenderer.send(IpcChannels.SELECTION_TOOLBAR_RESIZE, width),

  // Selection Assistant — bubble window
  selectionBubbleReady: (): void => ipcRenderer.send(IpcChannels.SELECTION_BUBBLE_READY),

  onSelectionBubbleData: (callback: (data: SelectionBubblePayload) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: SelectionBubblePayload): void =>
      callback(data)
    ipcRenderer.on(IpcChannels.SELECTION_BUBBLE_DATA, handler)
    return () => ipcRenderer.removeListener(IpcChannels.SELECTION_BUBBLE_DATA, handler)
  },

  selectionBubbleClose: (): void => ipcRenderer.send(IpcChannels.SELECTION_BUBBLE_CLOSE),

  setSelectionBubblePinned: (pinned: boolean): void =>
    ipcRenderer.send(IpcChannels.SELECTION_BUBBLE_SET_PINNED, pinned),

  setSelectionBubbleStreaming: (streaming: boolean): void =>
    ipcRenderer.send(IpcChannels.SELECTION_BUBBLE_SET_STREAMING, streaming),

  // Selection Assistant — action CRUD
  listSelectionActions: (): Promise<IpcResult<SelectionAction[]>> =>
    ipcRenderer.invoke(IpcChannels.SELECTION_ACTION_LIST),

  createSelectionAction: (data: {
    name: string
    description?: string
    systemPrompt?: string
    icon?: string
  }): Promise<IpcResult<SelectionAction>> =>
    ipcRenderer.invoke(IpcChannels.SELECTION_ACTION_CREATE, data),

  updateSelectionAction: (
    id: string,
    data: Partial<
      Pick<SelectionAction, 'name' | 'description' | 'systemPrompt' | 'icon' | 'enabled'>
    >,
  ): Promise<IpcResult<SelectionAction | undefined>> =>
    ipcRenderer.invoke(IpcChannels.SELECTION_ACTION_UPDATE, id, data),

  deleteSelectionAction: (id: string): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.SELECTION_ACTION_DELETE, id),

  reorderSelectionActions: (ids: string[]): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.SELECTION_ACTION_REORDER, ids),

  // Selection Assistant — streaming AI
  selectionRequest: (payload: SelectionRequestPayload): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.SELECTION_REQUEST, payload),

  stopSelectionRequest: (): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.SELECTION_STOP),

  onSelectionChunk: (callback: (data: SelectionChunkData) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: SelectionChunkData): void =>
      callback(data)
    ipcRenderer.on(IpcChannels.SELECTION_CHUNK, handler)
    return () => ipcRenderer.removeListener(IpcChannels.SELECTION_CHUNK, handler)
  },

  onSelectionEnd: (callback: (data: SelectionEndData) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: SelectionEndData): void => callback(data)
    ipcRenderer.on(IpcChannels.SELECTION_END, handler)
    return () => ipcRenderer.removeListener(IpcChannels.SELECTION_END, handler)
  },

  onSelectionError: (callback: (data: SelectionErrorData) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: SelectionErrorData): void =>
      callback(data)
    ipcRenderer.on(IpcChannels.SELECTION_ERROR, handler)
    return () => ipcRenderer.removeListener(IpcChannels.SELECTION_ERROR, handler)
  },

  removeAllSelectionStreamListeners: (): void => {
    ipcRenderer.removeAllListeners(IpcChannels.SELECTION_CHUNK)
    ipcRenderer.removeAllListeners(IpcChannels.SELECTION_END)
    ipcRenderer.removeAllListeners(IpcChannels.SELECTION_ERROR)
  },

  // Selection Assistant — toggle + shortcut + runtime filter config
  toggleSelectionAssistant: (): Promise<IpcResult<boolean>> =>
    ipcRenderer.invoke(IpcChannels.SELECTION_TOGGLE),

  updateSelectionShortcut: (): Promise<IpcResult<{ registered: boolean }>> =>
    ipcRenderer.invoke(IpcChannels.SELECTION_UPDATE_SHORTCUT),

  refreshSelectionFilter: (): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.SELECTION_REFRESH_FILTER),

  onSelectionStateChanged: (callback: (enabled: boolean) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, enabled: boolean): void => callback(enabled)
    ipcRenderer.on(IpcChannels.SELECTION_STATE_CHANGED, handler)
    return () => ipcRenderer.removeListener(IpcChannels.SELECTION_STATE_CHANGED, handler)
  },

  // User profile
  saveUserAvatar: (): Promise<IpcResult<string | null>> =>
    ipcRenderer.invoke(IpcChannels.USER_SAVE_AVATAR),

  readUserAvatar: (relativePath: string): Promise<IpcResult<string>> =>
    ipcRenderer.invoke(IpcChannels.USER_READ_AVATAR, relativePath),

  // Auto Updater
  getUpdaterState: (): Promise<IpcResult<UpdaterState>> =>
    ipcRenderer.invoke(IpcChannels.UPDATER_GET_STATE),

  checkForUpdates: (): Promise<IpcResult<void>> => ipcRenderer.invoke(IpcChannels.UPDATER_CHECK),

  downloadUpdate: (): Promise<IpcResult<void>> => ipcRenderer.invoke(IpcChannels.UPDATER_DOWNLOAD),

  quitAndInstallUpdate: (): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.UPDATER_QUIT_AND_INSTALL),

  openReleasePage: (): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.UPDATER_OPEN_RELEASE_PAGE),

  onUpdaterStateChanged: (callback: (state: UpdaterState) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, state: UpdaterState): void => callback(state)
    ipcRenderer.on(IpcChannels.UPDATER_STATE_CHANGED, handler)
    return () => ipcRenderer.removeListener(IpcChannels.UPDATER_STATE_CHANGED, handler)
  },

  // Backup
  backup: {
    exportToFile: (password: string): Promise<IpcResult<{ filePath: string }>> =>
      ipcRenderer.invoke(IpcChannels.BACKUP_EXPORT_TO_FILE, { password }),

    peekFile: (filePath: string): Promise<IpcResult<BackupFileMeta>> =>
      ipcRenderer.invoke(IpcChannels.BACKUP_PEEK_FILE, { filePath }),

    pickFile: (): Promise<IpcResult<{ filePath: string } | null>> =>
      ipcRenderer.invoke(IpcChannels.BACKUP_PICK_FILE),

    importFromFile: (payload: {
      filePath?: string
      password: string
      mode: BackupImportMode
    }): Promise<IpcResult<{ applied: BackupSummary }>> =>
      ipcRenderer.invoke(IpcChannels.BACKUP_IMPORT_FROM_FILE, payload),

    getRemoteConfig: (): Promise<IpcResult<RemoteConfigs>> =>
      ipcRenderer.invoke(IpcChannels.BACKUP_GET_REMOTE_CONFIG),

    setRemoteConfig: (cfg: RemoteConfig): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IpcChannels.BACKUP_SET_REMOTE_CONFIG, { config: cfg }),

    clearRemoteConfig: (type: RemoteType): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IpcChannels.BACKUP_CLEAR_REMOTE_CONFIG, { type }),

    testRemote: (cfg: RemoteConfig): Promise<IpcResult<{ ok: boolean; latency?: number }>> =>
      ipcRenderer.invoke(IpcChannels.BACKUP_TEST_REMOTE, cfg),

    syncNow: (type: RemoteType): Promise<IpcResult<SyncResult>> =>
      ipcRenderer.invoke(IpcChannels.BACKUP_SYNC_NOW, { type }),

    syncCancel: (type: RemoteType): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IpcChannels.BACKUP_SYNC_CANCEL, { type }),

    setRemoteEnabled: (type: RemoteType, enabled: boolean): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IpcChannels.BACKUP_SET_REMOTE_ENABLED, { type, enabled }),

    listRemote: (type: RemoteType): Promise<IpcResult<RemoteBackupItem[]>> =>
      ipcRenderer.invoke(IpcChannels.BACKUP_LIST_REMOTE, { type }),

    restoreFromRemote: (payload: {
      type: RemoteType
      key: string
      password: string
      mode: BackupImportMode
    }): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IpcChannels.BACKUP_RESTORE_FROM_REMOTE, payload),

    getStatus: (): Promise<IpcResult<BackupStatus>> =>
      ipcRenderer.invoke(IpcChannels.BACKUP_GET_STATUS),

    listRollbacks: (): Promise<IpcResult<RollbackBackupItem[]>> =>
      ipcRenderer.invoke(IpcChannels.BACKUP_LIST_ROLLBACKS),

    onStatusChanged: (cb: (status: BackupStatus) => void): (() => void) => {
      const fn = (_e: Electron.IpcRendererEvent, status: BackupStatus): void => cb(status)
      ipcRenderer.on(IpcChannels.BACKUP_STATUS_CHANGED, fn)
      return () => ipcRenderer.removeListener(IpcChannels.BACKUP_STATUS_CHANGED, fn)
    },

    onProgress: (cb: (p: BackupProgress) => void): (() => void) => {
      const fn = (_e: Electron.IpcRendererEvent, p: BackupProgress): void => cb(p)
      ipcRenderer.on(IpcChannels.BACKUP_PROGRESS, fn)
      return () => ipcRenderer.removeListener(IpcChannels.BACKUP_PROGRESS, fn)
    },
  },
}

export type ApiType = typeof api

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
