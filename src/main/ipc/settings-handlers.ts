import { ipcMain, BrowserWindow } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import { clampZoom } from '@shared/zoom'
import type { IpcResult } from '@shared/types'
import { getSetting, setSetting, setSettingsBatch, getAllSettings } from '../db'
import { applySslSetting } from '../ai'
import {
  applyCloseToTraySetting,
  applyAutoLaunchSetting,
  applySpellCheckSetting,
  applyStartMinimizedSetting,
} from '../app-state'

function applyZoomSetting(value: string): void {
  const factor = parseFloat(value)
  if (isNaN(factor)) return
  const clamped = clampZoom(factor)
  const win = BrowserWindow.getAllWindows()[0]
  if (win) {
    win.webContents.setZoomFactor(clamped)
    win.webContents.send(IpcChannels.WINDOW_ZOOM_CHANGED, clamped)
  }
}

const settingSideEffects: Record<string, (value: string) => void> = {
  'app.skipSslVerify': (v) => applySslSetting(v === 'true'),
  'app.closeToTray': applyCloseToTraySetting,
  'app.autoLaunch': applyAutoLaunchSetting,
  'app.spellCheck': applySpellCheckSetting,
  'app.startMinimized': applyStartMinimizedSetting,
  'display.zoomFactor': applyZoomSetting,
}

function applySideEffects(key: string, value: string): void {
  settingSideEffects[key]?.(value)
}

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
      applySideEffects(key, value)
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
        for (const [key, value] of Object.entries(entries)) {
          applySideEffects(key, value)
        }
        return { success: true }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    },
  )
}
