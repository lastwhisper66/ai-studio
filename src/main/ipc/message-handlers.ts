import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type { Message, MessageRole, IpcResult } from '@shared/types'
import { listMessages, createMessage, deleteMessage } from '../db'

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
}
