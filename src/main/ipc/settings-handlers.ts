import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type { IpcResult } from '@shared/types'
import { getSetting, setSetting, setSettingsBatch, getAllSettings } from '../db'
import { applySslSetting } from '../ai'
import { applyCloseToTraySetting } from '../app-state'

export function registerSettingsHandlers(): void {
  ipcMain.handle(IpcChannels.SETTINGS_GET, (_, key: string): IpcResult<string | undefined> => {
    try {
      const data = getSetting(key)
      return { success: true, data }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.SETTINGS_SET, (_, key: string, value: string): IpcResult<void> => {
    try {
      setSetting(key, value)
      if (key === 'app.skipSslVerify') {
        applySslSetting(value === 'true')
      }
      if (key === 'app.closeToTray') {
        applyCloseToTraySetting(value)
      }
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.SETTINGS_GET_ALL, (): IpcResult<Record<string, string>> => {
    try {
      const data = getAllSettings()
      return { success: true, data }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(
    IpcChannels.SETTINGS_SET_BATCH,
    (_, entries: Record<string, string>): IpcResult<void> => {
      try {
        setSettingsBatch(entries)
        if ('app.skipSslVerify' in entries) {
          applySslSetting(entries['app.skipSslVerify'] === 'true')
        }
        if ('app.closeToTray' in entries) {
          applyCloseToTraySetting(entries['app.closeToTray'])
        }
        return { success: true }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    },
  )
}
