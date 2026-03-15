import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type { IpcResult, Assistant } from '@shared/types'
import {
  listAssistants,
  getAssistant,
  createAssistant,
  updateAssistant,
  deleteAssistant,
} from '../db'
import type { CreateAssistantData, UpdateAssistantData } from '../db/assistants'

export function registerAssistantHandlers(): void {
  ipcMain.handle(IpcChannels.ASSISTANT_LIST, (): IpcResult<Assistant[]> => {
    try {
      const data = listAssistants()
      return { success: true, data }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.ASSISTANT_GET, (_, id: string): IpcResult<Assistant | undefined> => {
    try {
      const data = getAssistant(id)
      return { success: true, data }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(
    IpcChannels.ASSISTANT_CREATE,
    (_, data: CreateAssistantData): IpcResult<Assistant> => {
      try {
        const assistant = createAssistant(data)
        return { success: true, data: assistant }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    },
  )

  ipcMain.handle(
    IpcChannels.ASSISTANT_UPDATE,
    (_, id: string, data: UpdateAssistantData): IpcResult<Assistant | undefined> => {
      try {
        const assistant = updateAssistant(id, data)
        return { success: true, data: assistant }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    },
  )

  ipcMain.handle(IpcChannels.ASSISTANT_DELETE, (_, id: string): IpcResult<void> => {
    try {
      deleteAssistant(id)
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })
}
