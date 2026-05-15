import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type { IpcResult } from '@shared/types'
import { getSetting, setSetting, setSettingsBatch, getAllSettings } from '../db'
import { toLocalizedError } from '../errors'
import { applyAndBroadcast } from '../settings-bus'

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
      applyAndBroadcast({ [key]: value }, event.sender.id)
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
        applyAndBroadcast(entries, event.sender.id)
        return { success: true }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )
}
