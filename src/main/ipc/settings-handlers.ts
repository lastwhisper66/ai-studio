import { ipcMain, BrowserWindow } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import { clampZoom } from '@shared/zoom'
import type { IpcResult } from '@shared/types'
import { getSetting, setSetting, setSettingsBatch, getAllSettings } from '../db'
import { applySslSetting } from '../ai'
import { setMainLanguage, LANGUAGE_SETTING_KEY } from '../i18n'
import { toLocalizedError } from '../errors'
import {
  applyCloseToTraySetting,
  applyAutoLaunchSetting,
  applySpellCheckSetting,
  applyStartMinimizedSetting,
  applyQuickAssistantEnabled,
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

function applyLanguageSetting(value: string): void {
  setMainLanguage(value)
  // Broadcast to every renderer (main app + auxiliary windows like the
  // selection toolbar/bubble) so their i18next instances can switch without
  // a restart. Each renderer already initialized its instance from
  // localStorage at load time and won't otherwise observe the change.
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(IpcChannels.SETTINGS_LANGUAGE_CHANGED, value)
    }
  }
}

const settingSideEffects: Record<string, (value: string) => void> = {
  'app.skipSslVerify': (v) => applySslSetting(v === 'true'),
  'app.closeToTray': applyCloseToTraySetting,
  'app.autoLaunch': applyAutoLaunchSetting,
  'app.spellCheck': applySpellCheckSetting,
  'app.startMinimized': applyStartMinimizedSetting,
  'display.zoomFactor': applyZoomSetting,
  'quickAssistant.enabled': applyQuickAssistantEnabled,
  [LANGUAGE_SETTING_KEY]: applyLanguageSetting,
}

function applySideEffects(key: string, value: string): void {
  settingSideEffects[key]?.(value)
}

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
