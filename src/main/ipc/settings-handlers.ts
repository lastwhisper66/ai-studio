import { ipcMain, BrowserWindow } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type { IpcResult } from '@shared/types'
import { getSetting, setSetting, setSettingsBatch, getAllSettings } from '../db'
import { toLocalizedError } from '../errors'
import { applySideEffects } from '../settings-side-effects'

function broadcastSettingsChanged(entries: Record<string, string>, senderId?: number): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    if (senderId !== undefined && win.webContents.id === senderId) continue
    win.webContents.send(IpcChannels.SETTINGS_CHANGED, entries)
  }
}

export function registerSettingsHandlers(): void {
  ipcMain.handle(IpcChannels.SETTINGS_GET, (_, key: string): IpcResult<string | undefined> => {
    try {
      const data = getSetting(key)
      return { success: true, data }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(IpcChannels.SETTINGS_SET, (event, key: string, value: string): IpcResult<void> => {
    try {
      setSetting(key, value)
      applySideEffects(key, value)
      broadcastSettingsChanged({ [key]: value }, event.sender.id)
      return { success: true }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(IpcChannels.SETTINGS_GET_ALL, (): IpcResult<Record<string, string>> => {
    try {
      const data = getAllSettings()
      return { success: true, data }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(
    IpcChannels.SETTINGS_SET_BATCH,
    (event, entries: Record<string, string>): IpcResult<void> => {
      try {
        setSettingsBatch(entries)
        for (const [key, value] of Object.entries(entries)) {
          applySideEffects(key, value)
        }
        broadcastSettingsChanged(entries, event.sender.id)
        return { success: true }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )
}
