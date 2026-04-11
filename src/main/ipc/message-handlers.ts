import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type { Message, MessageRole, IpcResult, FileData } from '@shared/types'
import { isImageMime } from '@shared/types'
import { getDb } from '../db/database'
import {
  listMessages,
  listMessagesPaginated,
  createMessage,
  deleteMessage,
  updateMessageContent,
  clearConversationMessages,
  getMessageAttachments,
  insertDivider,
} from '../db'
import { saveAttachments, deleteAttachments } from '../db/attachments'

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
    (
      _,
      conversationId: string,
      role: MessageRole,
      content: string,
      files?: FileData[],
    ): IpcResult<Message> => {
      try {
        const imageFiles = files?.filter((f) => isImageMime(f.mimeType)) ?? []

        // Create the message first (without attachments)
        const data = createMessage(conversationId, role, content)

        // Save image attachments to disk and update message record
        if (imageFiles.length > 0) {
          const metas = saveAttachments(data.id, imageFiles)
          getDb()
            .prepare('UPDATE messages SET attachments = ? WHERE id = ?')
            .run(JSON.stringify(metas), data.id)
          data.attachments = metas
        }

        return { success: true, data }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    },
  )

  ipcMain.handle(IpcChannels.MESSAGE_DELETE, (_, id: string): IpcResult<void> => {
    try {
      deleteAttachments(id)
      deleteMessage(id)
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(
    IpcChannels.MESSAGE_UPDATE,
    (_, id: string, content: string): IpcResult<Message> => {
      try {
        const data = updateMessageContent(id, content)
        return { success: true, data }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    },
  )

  ipcMain.handle(IpcChannels.MESSAGE_CLEAR, (_, conversationId: string): IpcResult<void> => {
    try {
      const rows = getMessageAttachments(conversationId)
      for (const row of rows) {
        deleteAttachments(row.id)
      }
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
