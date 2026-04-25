import { app, screen } from 'electron'
import { basename } from 'path'
import SelectionHook, {
  type KeyboardEventData,
  type MouseEventData,
  type SelectionHookInstance,
  type TextSelectionData,
} from 'selection-hook'
import type { SelectionAction, SelectionAnchor, SelectionToolbarPayload } from '@shared/types'
import { DEFAULT_SELECTION_MAX_TEXT_LENGTH, DEFAULT_SELECTION_MIN_TEXT_LENGTH } from '@shared/types'
import type { SelectionTriggerMode } from '@shared/types'
import {
  getVisibleToolbarBounds,
  hideSelectionToolbar,
  setSelectionToolbarActionHandler,
  showSelectionToolbar,
} from './selection-toolbar-window'
import {
  hideSelectionBubble,
  showSelectionBubble,
  setSelectionBubbleHideHandler,
} from './selection-bubble-window'
import {
  applySelectionAssistantEnabled,
  getSelectionAssistantEnabled,
  initSelectionAssistant,
} from './app-state'
import { listSelectionActions, setSetting } from './db'
import { getSetting } from './db/settings'
import { abortSelectionRequest } from './ipc/selection-handlers'

/** Default cap — overridden by `selection.maxTextLength` setting. */
const DEFAULT_MAX_TEXT_LENGTH = DEFAULT_SELECTION_MAX_TEXT_LENGTH
const DEFAULT_MIN_TEXT_LENGTH = DEFAULT_SELECTION_MIN_TEXT_LENGTH

let hookInstance: SelectionHookInstance | null = null
let running = false

interface SelectionFilterConfig {
  excludedPrograms: string[]
  minTextLength: number
  maxTextLength: number
  clipboardFallback: boolean
  triggerMode: SelectionTriggerMode
}

let filterConfig: SelectionFilterConfig = {
  excludedPrograms: [],
  minTextLength: DEFAULT_MIN_TEXT_LENGTH,
  maxTextLength: DEFAULT_MAX_TEXT_LENGTH,
  clipboardFallback: true,
  triggerMode: 'selected',
}

function parseJsonArray(raw: string | undefined, fallback: string[]): string[] {
  if (!raw) return fallback
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : fallback
  } catch {
    return fallback
  }
}

function parseNumber(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

function loadFilterConfig(): SelectionFilterConfig {
  return {
    excludedPrograms: parseJsonArray(getSetting('selection.excludedPrograms'), []),
    minTextLength: Math.max(
      1,
      parseNumber(getSetting('selection.minTextLength'), DEFAULT_MIN_TEXT_LENGTH),
    ),
    maxTextLength: Math.max(
      1,
      parseNumber(getSetting('selection.maxTextLength'), DEFAULT_MAX_TEXT_LENGTH),
    ),
    clipboardFallback: getSetting('selection.clipboardFallback') !== 'false',
    triggerMode: getSetting('selection.triggerMode') === 'ctrlkey' ? 'ctrlkey' : 'selected',
  }
}

function loadEnabledActions(): SelectionAction[] {
  try {
    return listSelectionActions().filter((a) => a.enabled)
  } catch (err) {
    console.error('[SelectionService] Failed to load selection actions:', err)
    return []
  }
}

/**
 * Extract this app's executable name so we can filter our own selections.
 * Prefers the real exe path (app.getPath('exe')) because app.getName() may
 * not match what the OS reports as the foreground program (e.g. packaged name
 * contains spaces, or the dev build runs as `electron.exe`).
 */
function getSelfProgramNames(): string[] {
  const names = new Set<string>()
  try {
    const exePath = app.getPath('exe')
    if (exePath) {
      const exeBase = basename(exePath)
      names.add(exeBase)
      // Also the stem without .exe, in case the hook reports it that way
      names.add(exeBase.replace(/\.exe$/i, ''))
    }
  } catch {
    // ignore
  }
  const appName = app.getName()
  if (appName) {
    names.add(`${appName}.exe`)
    names.add(appName)
  }
  // Dev builds always run as electron.exe
  names.add('electron.exe')
  names.add('electron')
  return Array.from(names)
}

/** Full program exclusion list (user-configured + the app's own exe). */
function getEffectiveExcludedPrograms(): string[] {
  const set = new Set<string>(filterConfig.excludedPrograms)
  for (const name of getSelfProgramNames()) set.add(name)
  return Array.from(set)
}

/** Check whether a coordinate pair is the INVALID_COORDINATE sentinel. */
function isValidPoint(p: { x: number; y: number }): boolean {
  return p.x !== SelectionHook.INVALID_COORDINATE && p.y !== SelectionHook.INVALID_COORDINATE
}

/**
 * Compute an on-screen anchor rectangle (DIP) from a TextSelectionData.
 * selection-hook returns physical pixels; Electron's setBounds expects DIP,
 * so we convert via screen.screenToDipPoint().
 */
function computeAnchor(data: TextSelectionData): SelectionAnchor | null {
  const { posLevel } = data

  // Pick the best-available anchor based on the position level. Higher
  // levels provide real selection rectangles; lower levels only have the
  // mouse cursor position at selection end.
  let startPx: { x: number; y: number } | null = null
  let endPx: { x: number; y: number } | null = null

  if (
    posLevel === SelectionHook.PositionLevel.SEL_FULL ||
    posLevel === SelectionHook.PositionLevel.SEL_DETAILED
  ) {
    if (isValidPoint(data.startTop) && isValidPoint(data.endBottom)) {
      startPx = data.startTop
      endPx = data.endBottom
    }
  } else if (posLevel === SelectionHook.PositionLevel.MOUSE_DUAL) {
    if (isValidPoint(data.mousePosStart) && isValidPoint(data.mousePosEnd)) {
      startPx = data.mousePosStart
      endPx = data.mousePosEnd
    }
  } else if (posLevel === SelectionHook.PositionLevel.MOUSE_SINGLE) {
    if (isValidPoint(data.mousePosEnd)) {
      startPx = data.mousePosEnd
      endPx = data.mousePosEnd
    }
  }

  // Fallback: try mousePosEnd regardless
  if (!startPx && isValidPoint(data.mousePosEnd)) {
    startPx = data.mousePosEnd
    endPx = data.mousePosEnd
  }

  if (!startPx || !endPx) return null

  const startDip = screen.screenToDipPoint(startPx)
  const endDip = screen.screenToDipPoint(endPx)

  const x = Math.min(startDip.x, endDip.x)
  const y = Math.min(startDip.y, endDip.y)
  const width = Math.abs(endDip.x - startDip.x)
  const height = Math.abs(endDip.y - startDip.y)

  return { x, y, width, height }
}

function handleTextSelection(data: TextSelectionData): void {
  if (!getSelectionAssistantEnabled()) return

  const text = (data.text ?? '').trim()
  if (!text) return
  if (text.length < filterConfig.minTextLength) return
  if (text.length > filterConfig.maxTextLength) {
    hideSelectionToolbar()
    return
  }

  // Belt-and-suspenders: selection-hook's EXCLUDE_LIST already drops events
  // from excluded programs, but we also filter here in case the config
  // hasn't propagated yet or programName doesn't match exactly.
  const program = (data.programName ?? '').toLowerCase()
  if (program) {
    const selfMatch = getSelfProgramNames().some((n) => program.includes(n.toLowerCase()))
    if (selfMatch) return
    const userExcluded = filterConfig.excludedPrograms.some((n) =>
      program.includes(n.toLowerCase()),
    )
    if (userExcluded) return
  }

  const anchor = computeAnchor(data)
  if (!anchor) return

  // Ensure any stale toolbar from a prior selection is hidden first —
  // otherwise `showInactive` on the same instance just repositions.
  hideSelectionToolbar()

  const enabledActions = loadEnabledActions()
  if (enabledActions.length === 0) return

  const payload: SelectionToolbarPayload = {
    text,
    anchor,
    actions: enabledActions,
  }
  showSelectionToolbar(payload)
}

/**
 * Hide the toolbar when the user clicks outside of it. selection-hook reports
 * coords in physical pixels; convert to DIP before comparing against window
 * bounds (which are also DIP).
 */
function handleMouseDown(data: MouseEventData): void {
  const bounds = getVisibleToolbarBounds()
  if (!bounds) return
  if (data.x === SelectionHook.INVALID_COORDINATE || data.y === SelectionHook.INVALID_COORDINATE) {
    return
  }
  const dip = screen.screenToDipPoint({ x: data.x, y: data.y })
  const inside =
    dip.x >= bounds.x &&
    dip.x <= bounds.x + bounds.width &&
    dip.y >= bounds.y &&
    dip.y <= bounds.y + bounds.height
  if (!inside) {
    hideSelectionToolbar()
  }
}

/** Any wheel/key activity outside our toolbar dismisses it. */
function handleDismissEvent(): void {
  if (getVisibleToolbarBounds()) {
    hideSelectionToolbar()
  }
}

function handleKeyDismissEvent(data: KeyboardEventData): void {
  if (filterConfig.triggerMode === 'ctrlkey' && isCtrlKey(data.vkCode)) return
  handleDismissEvent()
}

function handleToolbarAction(actionId: string, payload: SelectionToolbarPayload): void {
  showSelectionBubble({
    text: payload.text,
    anchor: payload.anchor,
    actionId,
    actions: loadEnabledActions(),
  })
}

/** Push the current filter settings into the native hook. Safe before start(). */
function applyHookFilterConfig(hook: SelectionHookInstance): void {
  const excluded = getEffectiveExcludedPrograms()
  try {
    if (excluded.length > 0) {
      hook.setGlobalFilterMode(SelectionHook.FilterMode.EXCLUDE_LIST, excluded)
    } else {
      hook.setGlobalFilterMode(SelectionHook.FilterMode.DEFAULT, [])
    }
  } catch (err) {
    console.warn('[SelectionService] setGlobalFilterMode failed:', err)
  }
  try {
    if (filterConfig.clipboardFallback) {
      hook.enableClipboard()
    } else {
      hook.disableClipboard()
    }
  } catch (err) {
    if (err instanceof TypeError) {
      console.warn('[SelectionService] selection-hook version does not support clipboard toggle')
    } else {
      console.warn('[SelectionService] clipboard fallback toggle failed:', err)
    }
  }
}

// ── Ctrlkey mode state ──────────────────────────────────────────
let isCtrlkeyListenerActive = false
let ctrlHoldTimer: ReturnType<typeof setTimeout> | null = null

function isCtrlKey(vkCode: number): boolean {
  return vkCode === 162 || vkCode === 163 // VK_LCONTROL, VK_RCONTROL
}

function clearCtrlHoldTimer(): void {
  if (ctrlHoldTimer !== null) {
    clearTimeout(ctrlHoldTimer)
    ctrlHoldTimer = null
  }
}

function handleKeyDownCtrlkeyMode(data: KeyboardEventData): void {
  if (!hookInstance) return
  if (!isCtrlKey(data.vkCode)) {
    clearCtrlHoldTimer()
    return
  }
  if (ctrlHoldTimer !== null) return

  hookInstance.off('mouse-wheel', handleMouseWheelCtrlkeyMode)
  hookInstance.off('mouse-down', handleMouseDownCtrlkeyMode)
  hookInstance.on('mouse-wheel', handleMouseWheelCtrlkeyMode)
  hookInstance.on('mouse-down', handleMouseDownCtrlkeyMode)
  ctrlHoldTimer = setTimeout(() => {
    ctrlHoldTimer = null
    if (!hookInstance) return
    const selectionData = hookInstance.getCurrentSelection()
    if (selectionData) {
      // Passive mode: hook coordinates are unreliable (often 0,0).
      const cursor = screen.getCursorScreenPoint()
      selectionData.mousePosEnd = cursor
      selectionData.mousePosStart = cursor
      handleTextSelection(selectionData)
    }
  }, 350)
}

function handleKeyUpCtrlkeyMode(data: KeyboardEventData): void {
  if (!hookInstance) return
  if (!isCtrlKey(data.vkCode)) return
  clearCtrlHoldTimer()
  hookInstance.off('mouse-wheel', handleMouseWheelCtrlkeyMode)
  hookInstance.off('mouse-down', handleMouseDownCtrlkeyMode)
}

function handleMouseWheelCtrlkeyMode(): void {
  clearCtrlHoldTimer()
}

function handleMouseDownCtrlkeyMode(): void {
  clearCtrlHoldTimer()
}

// ── Trigger mode management ─────────────────────────────────────
function applyTriggerMode(hook: SelectionHookInstance): void {
  const mode = filterConfig.triggerMode

  if (isCtrlkeyListenerActive) {
    hook.off('key-down', handleKeyDownCtrlkeyMode)
    hook.off('key-up', handleKeyUpCtrlkeyMode)
    hook.off('mouse-wheel', handleMouseWheelCtrlkeyMode)
    hook.off('mouse-down', handleMouseDownCtrlkeyMode)
    clearCtrlHoldTimer()
    isCtrlkeyListenerActive = false
  }

  try {
    hook.setSelectionPassiveMode(mode === 'ctrlkey')
  } catch (err) {
    console.warn('[SelectionService] setSelectionPassiveMode not supported:', err)
  }

  if (mode === 'ctrlkey') {
    hook.on('key-down', handleKeyDownCtrlkeyMode)
    hook.on('key-up', handleKeyUpCtrlkeyMode)
    isCtrlkeyListenerActive = true
  }
}

/** Lazily create the hook instance (does not start it). */
function ensureHook(): SelectionHookInstance | null {
  if (hookInstance) return hookInstance
  try {
    const hook = new SelectionHook()
    hook.on('text-selection', handleTextSelection)
    hook.on('mouse-down', handleMouseDown)
    hook.on('mouse-wheel', handleDismissEvent)
    hook.on('key-down', handleKeyDismissEvent)
    hook.on('error', (err) => {
      console.error('[SelectionService] hook error:', err)
    })
    hookInstance = hook
    applyHookFilterConfig(hook)
    applyTriggerMode(hook)
    return hook
  } catch (err) {
    console.error('[SelectionService] Failed to construct SelectionHook:', err)
    return null
  }
}

/** Start the hook if the feature is enabled. Safe to call multiple times. */
function startHookIfEnabled(): void {
  if (!getSelectionAssistantEnabled()) return
  const hook = ensureHook()
  if (!hook) return
  if (running) return
  const ok = hook.start()
  if (ok) {
    running = true
  } else {
    console.warn('[SelectionService] hook.start() returned false')
  }
}

function stopHook(): void {
  if (hookInstance && running) {
    hookInstance.stop()
    running = false
  }
  // Also hide any visible UI when disabling
  hideSelectionToolbar()
  hideSelectionBubble()
}

/** Initialize service on app startup. Reads settings and starts hook when enabled. */
export function initSelectionService(): void {
  initSelectionAssistant()
  filterConfig = loadFilterConfig()
  setSelectionToolbarActionHandler(handleToolbarAction)
  // Abort any in-flight AI stream when the bubble closes, without the window
  // layer having to import from the IPC layer directly.
  setSelectionBubbleHideHandler(() => abortSelectionRequest())
  if (getSelectionAssistantEnabled()) {
    startHookIfEnabled()
  }
}

/** Flip the enabled flag (updates both setting + live hook state). */
export function toggleSelectionAssistant(): boolean {
  const next = !getSelectionAssistantEnabled()
  applySelectionAssistantEnabled(next ? 'true' : 'false')
  try {
    setSetting('selection.enabled', next ? 'true' : 'false')
  } catch (err) {
    console.warn('[SelectionService] failed to persist selection.enabled:', err)
  }
  if (next) {
    startHookIfEnabled()
  } else {
    stopHook()
  }
  return next
}

/**
 * Reload filter-related settings from DB and push them into the native hook.
 * Called from the renderer when the user changes any of the selection.* filter
 * options in Settings → Selection Assistant.
 */
export function refreshSelectionFilterConfig(): void {
  const oldMode = filterConfig.triggerMode
  filterConfig = loadFilterConfig()
  if (hookInstance) {
    applyHookFilterConfig(hookInstance)
    if (oldMode !== filterConfig.triggerMode) {
      applyTriggerMode(hookInstance)
    }
  }
}

export function isSelectionServiceRunning(): boolean {
  return running
}

/** Release native resources before app quit. */
export function cleanupSelectionService(): void {
  if (hookInstance) {
    try {
      hookInstance.cleanup()
    } catch (err) {
      console.warn('[SelectionService] cleanup error:', err)
    }
    hookInstance = null
    running = false
  }
}
