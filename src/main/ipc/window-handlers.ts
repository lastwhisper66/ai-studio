import { ipcMain, BrowserWindow } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import { clampZoom } from '@shared/zoom'

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

  ipcMain.on(IpcChannels.WINDOW_CLOSE, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  ipcMain.handle(IpcChannels.WINDOW_IS_MAXIMIZED, (event): boolean => {
    return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false
  })

  ipcMain.handle(IpcChannels.WINDOW_TOGGLE_ALWAYS_ON_TOP, (event): boolean => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return false
    const next = !win.isAlwaysOnTop()
    win.setAlwaysOnTop(next)
    return next
  })

  ipcMain.handle(IpcChannels.WINDOW_IS_ALWAYS_ON_TOP, (event): boolean => {
    return BrowserWindow.fromWebContents(event.sender)?.isAlwaysOnTop() ?? false
  })

  ipcMain.handle(IpcChannels.WINDOW_SET_ZOOM, (event, factor: number) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    const clamped = clampZoom(factor)
    win.webContents.setZoomFactor(clamped)
    win.webContents.send(IpcChannels.WINDOW_ZOOM_CHANGED, clamped)
  })

  ipcMain.handle(IpcChannels.WINDOW_GET_ZOOM, (event): number => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win?.webContents.getZoomFactor() ?? 1.0
  })
}
