import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IpcChannels } from '@shared/ipc-channels'
import type { Conversation, Message, MessageRole, IpcResult } from '@shared/types'

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
