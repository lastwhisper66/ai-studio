import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type { IpcResult, UpdaterState } from '@shared/types'
import {
  checkForUpdates,
  downloadUpdate,
  getUpdaterState,
  openReleasePage,
  quitAndInstall,
} from '../auto-updater'
import { toLocalizedError } from '../errors'

export function registerUpdaterHandlers(): void {
  ipcMain.handle(IpcChannels.UPDATER_GET_STATE, (): IpcResult<UpdaterState> => {
    try {
      return { success: true, data: getUpdaterState() }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(IpcChannels.UPDATER_CHECK, async (): Promise<IpcResult<void>> => {
    try {
      await checkForUpdates(true)
      return { success: true }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(IpcChannels.UPDATER_DOWNLOAD, async (): Promise<IpcResult<void>> => {
    try {
      await downloadUpdate()
      return { success: true }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(IpcChannels.UPDATER_QUIT_AND_INSTALL, (): IpcResult<void> => {
    try {
      quitAndInstall()
      return { success: true }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(IpcChannels.UPDATER_OPEN_RELEASE_PAGE, (): IpcResult<void> => {
    try {
      openReleasePage()
      return { success: true }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })
}
