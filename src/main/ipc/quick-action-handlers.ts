import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type { QuickAction, IpcResult } from '@shared/types'
import {
  listQuickActions,
  createQuickAction,
  updateQuickAction,
  deleteQuickAction,
  reorderQuickActions,
} from '../db'

export function registerQuickActionHandlers(): void {
  ipcMain.handle(IpcChannels.QUICK_ACTION_LIST, (): IpcResult<QuickAction[]> => {
    try {
      return { success: true, data: listQuickActions() }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(
    IpcChannels.QUICK_ACTION_CREATE,
    (
      _,
      data: { name: string; description?: string; systemPrompt?: string; icon?: string },
    ): IpcResult<QuickAction> => {
      try {
        return { success: true, data: createQuickAction(data) }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    },
  )

  ipcMain.handle(
    IpcChannels.QUICK_ACTION_UPDATE,
    (
      _,
      id: string,
      data: Partial<
        Pick<QuickAction, 'name' | 'description' | 'systemPrompt' | 'icon' | 'enabled'>
      >,
    ): IpcResult<QuickAction | undefined> => {
      try {
        return { success: true, data: updateQuickAction(id, data) }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    },
  )

  ipcMain.handle(IpcChannels.QUICK_ACTION_DELETE, (_, id: string): IpcResult<void> => {
    try {
      deleteQuickAction(id)
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.QUICK_ACTION_REORDER, (_, ids: string[]): IpcResult<void> => {
    try {
      reorderQuickActions(ids)
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })
}
