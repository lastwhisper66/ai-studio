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

  getSystemFonts: (): Promise<IpcResult<string[]>> => ipcRenderer.invoke(IpcChannels.APP_GET_FONTS),

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

  updateQuickAssistantShortcut: (): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.QUICK_ASSISTANT_UPDATE_SHORTCUT),

  updateSummonWindowShortcut: (): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.SUMMON_WINDOW_UPDATE_SHORTCUT),
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
