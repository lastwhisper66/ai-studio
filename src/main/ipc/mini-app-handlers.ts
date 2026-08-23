import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type { MiniApp, MiniAppRuntime, IpcResult } from '@shared/types'
import { toLocalizedError } from '../errors'
import {
  listMiniApps,
  getMiniApp,
  createMiniApp,
  updateMiniApp,
  deleteMiniApp,
  reorderMiniApps,
} from '../db'
import {
  getMiniAppPartition,
  resolveMiniAppUserAgent,
  clearMiniAppSession,
} from '../mini-app-session'

export function registerMiniAppHandlers(): void {
  ipcMain.handle(IpcChannels.MINI_APP_LIST, (): IpcResult<MiniApp[]> => {
    try {
      return { success: true, data: listMiniApps() }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(
    IpcChannels.MINI_APP_CREATE,
    (
      _,
      data: {
        name: string
        url: string
        icon?: string
        color?: string
        userAgent?: string
      },
    ): IpcResult<MiniApp> => {
      try {
        return { success: true, data: createMiniApp(data) }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(
    IpcChannels.MINI_APP_UPDATE,
    (
      _,
      id: string,
      data: Partial<Pick<MiniApp, 'name' | 'url' | 'icon' | 'color' | 'userAgent' | 'enabled'>>,
    ): IpcResult<MiniApp | undefined> => {
      try {
        return { success: true, data: updateMiniApp(id, data) }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(IpcChannels.MINI_APP_DELETE, (_, id: string): IpcResult<void> => {
    try {
      deleteMiniApp(id)
      return { success: true }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(IpcChannels.MINI_APP_REORDER, (_, ids: string[]): IpcResult<void> => {
    try {
      reorderMiniApps(ids)
      return { success: true }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  // Webview attributes for one app. The renderer calls this right before
  // mounting a <webview> — it cannot compute either value on its own.
  ipcMain.handle(IpcChannels.MINI_APP_GET_RUNTIME, (_, id: string): IpcResult<MiniAppRuntime> => {
    try {
      const app = getMiniApp(id)
      return {
        success: true,
        data: {
          id,
          partition: getMiniAppPartition(id),
          userAgent: resolveMiniAppUserAgent(app?.userAgent ?? ''),
        },
      }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(
    IpcChannels.MINI_APP_CLEAR_SESSION,
    async (_, id: string): Promise<IpcResult<void>> => {
      try {
        await clearMiniAppSession(id)
        return { success: true }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )
}
