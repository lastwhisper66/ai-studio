import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type { IpcResult, Model } from '@shared/types'
import { listAllModels, createModel, updateModel, deleteModel } from '../db'
import type { CreateModelData, UpdateModelData } from '../db/models'

export function registerModelHandlers(): void {
  ipcMain.handle(IpcChannels.MODEL_LIST, (): IpcResult<Model[]> => {
    try {
      const data = listAllModels()
      return { success: true, data }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.MODEL_CREATE, (_, data: CreateModelData): IpcResult<Model> => {
    try {
      const model = createModel(data)
      return { success: true, data: model }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(
    IpcChannels.MODEL_UPDATE,
    (_, id: string, data: UpdateModelData): IpcResult<Model | undefined> => {
      try {
        const model = updateModel(id, data)
        return { success: true, data: model }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    },
  )

  ipcMain.handle(IpcChannels.MODEL_DELETE, (_, id: string): IpcResult<void> => {
    try {
      deleteModel(id)
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })
}
