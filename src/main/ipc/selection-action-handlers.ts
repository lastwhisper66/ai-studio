import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type { SelectionAction, IpcResult } from '@shared/types'
import { toLocalizedError } from '../errors'
import {
  listSelectionActions,
  createSelectionAction,
  updateSelectionAction,
  deleteSelectionAction,
  reorderSelectionActions,
} from '../db'

export function registerSelectionActionHandlers(): void {
  ipcMain.handle(IpcChannels.SELECTION_ACTION_LIST, (): IpcResult<SelectionAction[]> => {
    try {
      return { success: true, data: listSelectionActions() }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(
    IpcChannels.SELECTION_ACTION_CREATE,
    (
      _,
      data: {
        name: string
        description?: string
        systemPrompt?: string
        icon?: string
      },
    ): IpcResult<SelectionAction> => {
      try {
        return { success: true, data: createSelectionAction(data) }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(
    IpcChannels.SELECTION_ACTION_UPDATE,
    (
      _,
      id: string,
      data: Partial<
        Pick<SelectionAction, 'name' | 'description' | 'systemPrompt' | 'icon' | 'enabled'>
      >,
    ): IpcResult<SelectionAction | undefined> => {
      try {
        return { success: true, data: updateSelectionAction(id, data) }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(IpcChannels.SELECTION_ACTION_DELETE, (_, id: string): IpcResult<void> => {
    try {
      deleteSelectionAction(id)
      return { success: true }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(IpcChannels.SELECTION_ACTION_REORDER, (_, ids: string[]): IpcResult<void> => {
    try {
      reorderSelectionActions(ids)
      return { success: true }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })
}
