import { EventEmitter } from 'events'
import { BrowserWindow } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import { setSetting, setSettingsBatch } from './db'
import { applySideEffects } from './settings-side-effects'

const emitter = new EventEmitter()

function broadcastToRenderers(entries: Record<string, string>, excludeSenderId?: number): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    if (excludeSenderId !== undefined && win.webContents.id === excludeSenderId) continue
    win.webContents.send(IpcChannels.SETTINGS_CHANGED, entries)
  }
}

/**
 * 副作用 + 跨 renderer 广播 + 主进程内事件；**不写库**。
 * IPC handler 调本函数（已经在 IPC 入口写过库），主进程内写设置用 writeSettingFromMain。
 */
export function applyAndBroadcast(entries: Record<string, string>, excludeSenderId?: number): void {
  for (const [k, v] of Object.entries(entries)) applySideEffects(k, v)
  broadcastToRenderers(entries, excludeSenderId)
  emitter.emit('changed', entries)
}

/** 主进程内主动写设置：写库 + applyAndBroadcast。 */
export function writeSettingFromMain(key: string, value: string): void {
  setSetting(key, value)
  applyAndBroadcast({ [key]: value })
}

export function writeSettingsFromMain(entries: Record<string, string>): void {
  setSettingsBatch(entries)
  applyAndBroadcast(entries)
}

export function onSettingsChanged(handler: (entries: Record<string, string>) => void): () => void {
  emitter.on('changed', handler)
  return () => emitter.off('changed', handler)
}
