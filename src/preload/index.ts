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
} from '@shared/types'

// Custom APIs for renderer — typed IPC wrappers
const api = {
  // Conversations
  listConversations: (): Promise<IpcResult<Conversation[]>> =>
    ipcRenderer.invoke(IpcChannels.CONVERSATION_LIST),

  getConversation: (id: string): Promise<IpcResult<Conversation | undefined>> =>
    ipcRenderer.invoke(IpcChannels.CONVERSATION_GET, id),

  createConversation: (title?: string): Promise<IpcResult<Conversation>> =>
    ipcRenderer.invoke(IpcChannels.CONVERSATION_CREATE, title),

  updateConversation: (
    id: string,
    data: Partial<Pick<Conversation, 'title' | 'model' | 'systemPrompt'>>,
  ): Promise<IpcResult<Conversation | undefined>> =>
    ipcRenderer.invoke(IpcChannels.CONVERSATION_UPDATE, id, data),

  deleteConversation: (id: string): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.CONVERSATION_DELETE, id),

  // Messages
  listMessages: (conversationId: string): Promise<IpcResult<Message[]>> =>
    ipcRenderer.invoke(IpcChannels.MESSAGE_LIST, conversationId),

  createMessage: (
    conversationId: string,
    role: MessageRole,
    content: string,
  ): Promise<IpcResult<Message>> =>
    ipcRenderer.invoke(IpcChannels.MESSAGE_CREATE, conversationId, role, content),

  deleteMessage: (id: string): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.MESSAGE_DELETE, id),

  // Settings
  getSetting: (key: string): Promise<IpcResult<string | undefined>> =>
    ipcRenderer.invoke(IpcChannels.SETTINGS_GET, key),

  setSetting: (key: string, value: string): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IpcChannels.SETTINGS_SET, key, value),

  getAllSettings: (): Promise<IpcResult<Record<string, string>>> =>
    ipcRenderer.invoke(IpcChannels.SETTINGS_GET_ALL),

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
