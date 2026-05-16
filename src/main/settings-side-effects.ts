import { BrowserWindow } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import { clampZoom } from '@shared/zoom'
import { applySslSetting } from './ai'
import { setMainLanguage, LANGUAGE_SETTING_KEY } from './i18n'
import {
  applyCloseToTraySetting,
  applyAutoLaunchSetting,
  applySpellCheckSetting,
  applyStartMinimizedSetting,
  applyQuickAssistantEnabled,
  applyAutoUpdateEnabledSetting,
} from './app-state'
import { backupSyncService } from './backup/sync-service'

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
  'app.autoUpdateEnabled': applyAutoUpdateEnabledSetting,
  'display.zoomFactor': applyZoomSetting,
  'quickAssistant.enabled': applyQuickAssistantEnabled,
  // Re-arm each per-remote auto-sync timer when its interval changes.
  // scheduleAuto(type) reads the value back from settings.
  'backup.remote.webdav.autoSyncIntervalMinutes': () => backupSyncService.scheduleAuto('webdav'),
  'backup.remote.s3.autoSyncIntervalMinutes': () => backupSyncService.scheduleAuto('s3'),
  [LANGUAGE_SETTING_KEY]: applyLanguageSetting,
}

export function applySideEffects(key: string, value: string): void {
  settingSideEffects[key]?.(value)
  // Any per-remote backup setting affects BackupStatus (interval / retention /
  // enabled flag). Re-broadcast so the renderer's
  // cached status reflects the new value without waiting for the next sync.
  if (key.startsWith('backup.remote.') || key === 'backup.lastLocalChangeAt') {
    backupSyncService.broadcastStatus()
  }
}
