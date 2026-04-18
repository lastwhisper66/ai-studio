import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type { IpcResult, ModelGroup } from '@shared/types'
import { toLocalizedError } from '../errors'
import { listModelGroups, createModelGroup, updateModelGroup, deleteModelGroup } from '../db'
import type { CreateModelGroupData, UpdateModelGroupData } from '../db/model-groups'

export function registerModelGroupHandlers(): void {
  ipcMain.handle(IpcChannels.MODEL_GROUP_LIST, (): IpcResult<ModelGroup[]> => {
    try {
      const data = listModelGroups()
      return { success: true, data }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(
    IpcChannels.MODEL_GROUP_CREATE,
    (_, data: CreateModelGroupData): IpcResult<ModelGroup> => {
      try {
        const group = createModelGroup(data)
        return { success: true, data: group }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(
    IpcChannels.MODEL_GROUP_UPDATE,
    (_, id: string, data: UpdateModelGroupData): IpcResult<ModelGroup | undefined> => {
      try {
        const group = updateModelGroup(id, data)
        return { success: true, data: group }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(IpcChannels.MODEL_GROUP_DELETE, (_, id: string): IpcResult<void> => {
    try {
      deleteModelGroup(id)
      return { success: true }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })
}
