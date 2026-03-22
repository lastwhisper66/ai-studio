import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type { Message, MessageRole, IpcResult } from '@shared/types'
import {
  listMessages,
  listMessagesPaginated,
  createMessage,
  deleteMessage,
  clearConversationMessages,
  insertDivider,
} from '../db'

export function registerMessageHandlers(): void {
  ipcMain.handle(IpcChannels.MESSAGE_LIST, (_, conversationId: string): IpcResult<Message[]> => {
    try {
      const data = listMessages(conversationId)
      return { success: true, data }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(
    IpcChannels.MESSAGE_LIST_PAGINATED,
    (
      _,
      conversationId: string,
      limit?: number,
      beforeCreatedAt?: string,
    ): IpcResult<{ messages: Message[]; hasMore: boolean }> => {
      try {
        const data = listMessagesPaginated(conversationId, limit, beforeCreatedAt)
        return { success: true, data }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    },
  )

  ipcMain.handle(
    IpcChannels.MESSAGE_CREATE,
    (_, conversationId: string, role: MessageRole, content: string): IpcResult<Message> => {
      try {
        const data = createMessage(conversationId, role, content)
        return { success: true, data }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    },
  )

  ipcMain.handle(IpcChannels.MESSAGE_DELETE, (_, id: string): IpcResult<void> => {
    try {
      deleteMessage(id)
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.MESSAGE_CLEAR, (_, conversationId: string): IpcResult<void> => {
    try {
      clearConversationMessages(conversationId)
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(
    IpcChannels.MESSAGE_INSERT_DIVIDER,
    (_, conversationId: string): IpcResult<Message> => {
      try {
        return { success: true, data: insertDivider(conversationId) }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    },
  )
}
