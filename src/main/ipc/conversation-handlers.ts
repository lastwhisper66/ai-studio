import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type { Conversation, IpcResult } from '@shared/types'
import {
  listConversations,
  getConversation,
  createConversation,
  updateConversation,
  deleteConversation,
  deleteConversations,
} from '../db'

export function registerConversationHandlers(): void {
  ipcMain.handle(IpcChannels.CONVERSATION_LIST, (): IpcResult<Conversation[]> => {
    try {
      const data = listConversations()
      return { success: true, data }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(
    IpcChannels.CONVERSATION_GET,
    (_, id: string): IpcResult<Conversation | undefined> => {
      try {
        const data = getConversation(id)
        return { success: true, data }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    },
  )

  ipcMain.handle(
    IpcChannels.CONVERSATION_CREATE,
    (_, title?: string, assistantId?: string): IpcResult<Conversation> => {
      try {
        const data = createConversation(title, assistantId)
        return { success: true, data }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    },
  )

  ipcMain.handle(
    IpcChannels.CONVERSATION_UPDATE,
    (
      _,
      id: string,
      data: Partial<
        Pick<Conversation, 'title' | 'model' | 'systemPrompt' | 'assistantId' | 'pinned'>
      >,
    ): IpcResult<Conversation | undefined> => {
      try {
        const result = updateConversation(id, data)
        return { success: true, data: result }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    },
  )

  ipcMain.handle(IpcChannels.CONVERSATION_DELETE, (_, id: string): IpcResult<void> => {
    try {
      deleteConversation(id)
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.CONVERSATION_DELETE_MANY, (_, ids: string[]): IpcResult<void> => {
    try {
      if (!Array.isArray(ids) || ids.length === 0) return { success: true }
      deleteConversations(ids)
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })
}
