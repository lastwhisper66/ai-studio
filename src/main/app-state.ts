import { getSetting } from './db/settings'

let closeToTray = true

/** Initialize from DB — call after initDatabase(). */
export function initCloseToTray(): void {
  closeToTray = getSetting('app.closeToTray') !== 'false'
}

/** Apply setting change at runtime — call from IPC handler. */
export function applyCloseToTraySetting(value?: string): void {
  closeToTray = value !== 'false'
}

export function getCloseToTray(): boolean {
  return closeToTray
}
