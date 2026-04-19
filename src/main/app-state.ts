import { app, session } from 'electron'
import { is } from '@electron-toolkit/utils'
import { getSetting } from './db/settings'

let closeToTray = true
let startMinimized = false

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

// ── Start minimized ─────────────────────────────────────────────

export function initStartMinimized(): void {
  startMinimized = getSetting('app.startMinimized') === 'true'
}

export function applyStartMinimizedSetting(value?: string): void {
  startMinimized = value === 'true'
}

export function getStartMinimized(): boolean {
  return startMinimized
}

// ── Auto launch ─────────────────────────────────────────────────

export function initAutoLaunch(): void {
  const enabled = getSetting('app.autoLaunch') === 'true'
  applyAutoLaunchSetting(enabled ? 'true' : 'false')
}

export function applyAutoLaunchSetting(value?: string): void {
  if (is.dev) return
  const enabled = value === 'true'
  app.setLoginItemSettings({ openAtLogin: enabled })
}

// ── Spell check ─────────────────────────────────────────────────

export function initSpellCheck(): void {
  const enabled = getSetting('app.spellCheck') !== 'false'
  applySpellCheckSetting(enabled ? 'true' : 'false')
}

export function applySpellCheckSetting(value?: string): void {
  const enabled = value !== 'false'
  session.defaultSession.setSpellCheckerEnabled(enabled)
}

// ── Quick Assistant ─────────────────────────────────────────────

let quickAssistantEnabled = false

export function initQuickAssistant(): void {
  quickAssistantEnabled = getSetting('quickAssistant.enabled') === 'true'
}

export function applyQuickAssistantEnabled(value?: string): void {
  quickAssistantEnabled = value === 'true'
}

export function getQuickAssistantEnabled(): boolean {
  return quickAssistantEnabled
}

// ── Selection Assistant ─────────────────────────────────────────

let selectionAssistantEnabled = false

export function initSelectionAssistant(): void {
  selectionAssistantEnabled = getSetting('selection.enabled') === 'true'
}

export function applySelectionAssistantEnabled(value?: string): void {
  selectionAssistantEnabled = value === 'true'
}

export function getSelectionAssistantEnabled(): boolean {
  return selectionAssistantEnabled
}
