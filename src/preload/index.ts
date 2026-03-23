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
  StreamEndData,
  StreamErrorData,
  TitleUpdatedData,
  Provider,
  Model,
  Assistant,
  Phrase,
  FileData,
  TranslateRequestPayload,
  TranslateChunkData,
  TranslateEndData,
  TranslateErrorData,
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
    data: Partial<Pick<Conversation, 'title' | 'model' | 'systemPrompt' | 'pinned'>>,
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
  ): Promise<IpcResult<Message>> =>
    ipcRenderer.invoke(IpcChannels.MESSAGE_CREATE, conversationId, role, content),

  deleteMessage: (id: string): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.MESSAGE_DELETE, id),

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

  createProvider: (
    data: Partial<Provider> & { type: Provider['type']; name: string },
  ): Promise<IpcResult<Provider>> => ipcRenderer.invoke(IpcChannels.PROVIDER_CREATE, data),

  updateProvider: (id: string, data: Partial<Provider>): Promise<IpcResult<Provider | undefined>> =>
    ipcRenderer.invoke(IpcChannels.PROVIDER_UPDATE, id, data),

  deleteProvider: (id: string): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.PROVIDER_DELETE, id),

  testProviderConnection: (provider: Provider): Promise<IpcResult<string>> =>
    ipcRenderer.invoke(IpcChannels.PROVIDER_TEST_CONNECTION, provider),

  // Models
  listModels: (): Promise<IpcResult<Model[]>> => ipcRenderer.invoke(IpcChannels.MODEL_LIST),

  createModel: (data: {
    providerId: string
    name: string
    group?: string
  }): Promise<IpcResult<Model>> => ipcRenderer.invoke(IpcChannels.MODEL_CREATE, data),

  updateModel: (id: string, data: Partial<Model>): Promise<IpcResult<Model | undefined>> =>
    ipcRenderer.invoke(IpcChannels.MODEL_UPDATE, id, data),

  deleteModel: (id: string): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.MODEL_DELETE, id),

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
