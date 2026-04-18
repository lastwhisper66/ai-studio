import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type { IpcResult, ModelDefinition } from '@shared/types'
import { toLocalizedError } from '../errors'
import {
  listModelDefinitions,
  createModelDefinition,
  updateModelDefinition,
  deleteModelDefinition,
} from '../db'
import type { CreateModelDefinitionData, UpdateModelDefinitionData } from '../db/model-definitions'

export function registerModelDefinitionHandlers(): void {
  ipcMain.handle(IpcChannels.MODEL_DEFINITION_LIST, (): IpcResult<ModelDefinition[]> => {
    try {
      const data = listModelDefinitions()
      return { success: true, data }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(
    IpcChannels.MODEL_DEFINITION_CREATE,
    (_, data: CreateModelDefinitionData): IpcResult<ModelDefinition> => {
      try {
        const def = createModelDefinition(data)
        return { success: true, data: def }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(
    IpcChannels.MODEL_DEFINITION_UPDATE,
    (_, id: string, data: UpdateModelDefinitionData): IpcResult<ModelDefinition | undefined> => {
      try {
        const def = updateModelDefinition(id, data)
        return { success: true, data: def }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(IpcChannels.MODEL_DEFINITION_DELETE, (_, id: string): IpcResult<void> => {
    try {
      deleteModelDefinition(id)
      return { success: true }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })
}
