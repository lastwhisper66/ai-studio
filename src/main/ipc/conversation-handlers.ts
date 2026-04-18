import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type { Conversation, IpcResult } from '@shared/types'
import { toLocalizedError } from '../errors'
import {
  listConversations,
  getConversation,
  createConversation,
  updateConversation,
  deleteConversation,
  deleteConversations,
  getMessageAttachments,
} from '../db'
import { deleteAttachments } from '../db/attachments'

function cleanupConversationAttachments(conversationId: string): void {
  const rows = getMessageAttachments(conversationId)
  for (const row of rows) {
    deleteAttachments(row.id)
  }
}

export function registerConversationHandlers(): void {
  ipcMain.handle(IpcChannels.CONVERSATION_LIST, (): IpcResult<Conversation[]> => {
    try {
      const data = listConversations()
      return { success: true, data }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(
    IpcChannels.CONVERSATION_GET,
    (_, id: string): IpcResult<Conversation | undefined> => {
      try {
        const data = getConversation(id)
        return { success: true, data }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
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
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(
    IpcChannels.CONVERSATION_UPDATE,
    (
      _,
      id: string,
      data: Partial<Pick<Conversation, 'title' | 'systemPrompt' | 'assistantId' | 'pinned'>>,
    ): IpcResult<Conversation | undefined> => {
      try {
        const result = updateConversation(id, data)
        return { success: true, data: result }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(IpcChannels.CONVERSATION_DELETE, (_, id: string): IpcResult<void> => {
    try {
      cleanupConversationAttachments(id)
      deleteConversation(id)
      return { success: true }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(IpcChannels.CONVERSATION_DELETE_MANY, (_, ids: string[]): IpcResult<void> => {
    try {
      if (!Array.isArray(ids) || ids.length === 0) return { success: true }
      for (const id of ids) {
        cleanupConversationAttachments(id)
      }
      deleteConversations(ids)
      return { success: true }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })
}
