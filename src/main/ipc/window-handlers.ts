import { ipcMain, BrowserWindow } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'

export function registerWindowHandlers(): void {
  ipcMain.handle(IpcChannels.WINDOW_MINIMIZE, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  ipcMain.handle(IpcChannels.WINDOW_MAXIMIZE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
  })

  ipcMain.handle(IpcChannels.WINDOW_CLOSE, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  ipcMain.handle(IpcChannels.WINDOW_IS_MAXIMIZED, (event): boolean => {
    return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false
  })
}
