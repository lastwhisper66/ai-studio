import { app, screen, shell } from 'electron'
import { basename } from 'path'
import SelectionHook, {
  type KeyboardEventData,
  type MouseEventData,
  type SelectionHookInstance,
  type TextSelectionData,
} from 'selection-hook'
import type { SelectionAction, SelectionAnchor, SelectionToolbarPayload } from '@shared/types'
import {
  BUILTIN_SEARCH_ACTION_ID,
  DEFAULT_SELECTION_MAX_TEXT_LENGTH,
  DEFAULT_SELECTION_MIN_TEXT_LENGTH,
} from '@shared/types'
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

const SEARCH_ENGINES: Record<string, string> = {
  google: 'https://www.google.com/search?q={query}',
  bing: 'https://www.bing.com/search?q={query}',
  baidu: 'https://www.baidu.com/s?wd={query}',
  duckduckgo: 'https://duckduckgo.com/?q={query}',
}

const DEFAULT_SEARCH_ENGINE = 'google'

const ALLOWED_PROTOCOLS = ['https:', 'http:']

function buildSearchUrl(text: string): string {
  const engineId = getSetting('selection.searchEngine') || DEFAULT_SEARCH_ENGINE
  let template: string
  if (engineId === 'custom') {
    const custom = getSetting('selection.searchEngineCustomUrl') || ''
    try {
      const { protocol } = new URL(custom.replaceAll('{query}', 'test'))
      template = ALLOWED_PROTOCOLS.includes(protocol)
        ? custom
        : SEARCH_ENGINES[DEFAULT_SEARCH_ENGINE]
    } catch {
      template = SEARCH_ENGINES[DEFAULT_SEARCH_ENGINE]
    }
  } else {
    template = SEARCH_ENGINES[engineId] || SEARCH_ENGINES[DEFAULT_SEARCH_ENGINE]
  }
  return template.replaceAll('{query}', encodeURIComponent(text))
}

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
  triggerMode: 'ctrlkey',
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
    triggerMode: getSetting('selection.triggerMode') === 'selected' ? 'selected' : 'ctrlkey',
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

/**
 * Pixel offset added to mouse-based Y coordinates (physical pixels, before
 * DIP conversion) so the anchor clears the text line. Mouse cursors sit at
 * the text baseline, not at the bottom of the line box. Cherry Studio uses
 * 16px for the same purpose.
 */
const MOUSE_Y_OFFSET_PX = 16

/** Check whether a coordinate pair is the INVALID_COORDINATE sentinel. */
function isValidPoint(p: { x: number; y: number }): boolean {
  return p.x !== SelectionHook.INVALID_COORDINATE && p.y !== SelectionHook.INVALID_COORDINATE
}

/**
 * Compute an on-screen anchor rectangle (DIP) from a TextSelectionData.
 * selection-hook returns physical pixels; Electron's setBounds expects DIP,
 * so we convert via screen.screenToDipPoint().
 *
 * Offset strategy (mirrors Cherry Studio):
 *  - MOUSE_SINGLE / MOUSE_DUAL: mouse cursor sits at the text baseline, so
 *    we push the anchor bottom down by MOUSE_Y_OFFSET_PX before DIP conversion.
 *  - MOUSE_DUAL with upward drag: the anchor top is pushed up so the toolbar
 *    can flip above the selection without overlapping.
 *  - SEL_FULL / SEL_DETAILED: real selection rectangles already include the
 *    full line height, no extra offset needed.
 */
function computeAnchor(data: TextSelectionData): SelectionAnchor | null {
  const { posLevel } = data

  let topPx: { x: number; y: number } | null = null
  let bottomPx: { x: number; y: number } | null = null
  let preferTop = false

  if (
    posLevel === SelectionHook.PositionLevel.SEL_FULL ||
    posLevel === SelectionHook.PositionLevel.SEL_DETAILED
  ) {
    if (isValidPoint(data.startTop) && isValidPoint(data.endBottom)) {
      topPx = data.startTop
      bottomPx = data.endBottom
      // If mouse info is available, detect upward drag
      if (isValidPoint(data.mousePosStart) && isValidPoint(data.mousePosEnd)) {
        preferTop = data.mousePosEnd.y - data.mousePosStart.y < -14
      }
    }
  } else if (posLevel === SelectionHook.PositionLevel.MOUSE_DUAL) {
    if (isValidPoint(data.mousePosStart) && isValidPoint(data.mousePosEnd)) {
      const yDist = data.mousePosEnd.y - data.mousePosStart.y

      if (Math.abs(yDist) > 14) {
        // Multi-line selection
        if (yDist > 0) {
          // Dragged downward — anchor bottom below the end point
          topPx = data.mousePosStart
          bottomPx = { x: data.mousePosEnd.x, y: data.mousePosEnd.y + MOUSE_Y_OFFSET_PX }
        } else {
          // Dragged upward — anchor top above the end point
          topPx = { x: data.mousePosEnd.x, y: data.mousePosEnd.y - MOUSE_Y_OFFSET_PX }
          bottomPx = data.mousePosStart
          preferTop = true
        }
      } else {
        // Same-line selection — push bottom down
        const maxY = Math.max(data.mousePosStart.y, data.mousePosEnd.y)
        const minX = Math.min(data.mousePosStart.x, data.mousePosEnd.x)
        topPx = { x: minX, y: data.mousePosStart.y }
        bottomPx = { x: data.mousePosEnd.x, y: maxY + MOUSE_Y_OFFSET_PX }
      }
    }
  } else if (posLevel === SelectionHook.PositionLevel.MOUSE_SINGLE) {
    if (isValidPoint(data.mousePosEnd)) {
      topPx = data.mousePosEnd
      bottomPx = { x: data.mousePosEnd.x, y: data.mousePosEnd.y + MOUSE_Y_OFFSET_PX }
    }
  }

  // Fallback: try mousePosEnd regardless
  if (!topPx && isValidPoint(data.mousePosEnd)) {
    topPx = data.mousePosEnd
    bottomPx = { x: data.mousePosEnd.x, y: data.mousePosEnd.y + MOUSE_Y_OFFSET_PX }
  }

  if (!topPx || !bottomPx) return null

  const startDip = screen.screenToDipPoint(topPx)
  const endDip = screen.screenToDipPoint(bottomPx)

  const x = Math.min(startDip.x, endDip.x)
  const y = Math.min(startDip.y, endDip.y)
  const width = Math.abs(endDip.x - startDip.x)
  const height = Math.abs(endDip.y - startDip.y)

  return { x, y, width, height, preferTop }
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

  // In ctrlkey mode, cache the selection for later use when Ctrl is held.
  // The toolbar is not shown until the user actually holds Ctrl.
  if (filterConfig.triggerMode === 'ctrlkey') {
    cacheSelection(data)
    return
  }

  showToolbarForSelection(data)
}

function showToolbarForSelection(data: TextSelectionData): void {
  const text = (data.text ?? '').trim()
  if (!text) return
  if (text.length < filterConfig.minTextLength) return
  if (text.length > filterConfig.maxTextLength) return

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
  invalidateSelectionCache()
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
  if (actionId === BUILTIN_SEARCH_ACTION_ID) {
    const url = buildSearchUrl(payload.text)
    try {
      const { protocol } = new URL(url)
      if (!ALLOWED_PROTOCOLS.includes(protocol)) return
    } catch {
      return
    }
    shell.openExternal(url).catch((err) => {
      console.warn('[SelectionService] openExternal failed:', err)
    })
    return
  }
  showSelectionBubble({
    text: payload.text,
    anchor: payload.anchor,
    actionId,
    actions: loadEnabledActions().filter((a) => a.id !== BUILTIN_SEARCH_ACTION_ID),
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
// True once a Ctrl hold has been handled (timer fired and shown the toolbar).
// A held Ctrl key emits repeating key-down events via the low-level keyboard
// hook; without this guard each repeat would re-arm the timer after it fires
// and re-show the toolbar every ~350ms, producing visible flicker. Reset on
// key-up so the next independent hold works again.
let ctrlHoldHandled = false

// ── Cached selection for ctrlkey mode ──────────────────────────
// In ctrlkey mode the hook stays in active mode so text-selection events fire
// on every mouse-up after drag. We cache the latest event data and use it when
// Ctrl is held, avoiding the less reliable getCurrentSelection() path.
interface CachedSelection {
  data: TextSelectionData
  timestamp: number
}
let cachedSelection: CachedSelection | null = null
const SELECTION_CACHE_TTL_MS = 30_000

function isCtrlKey(vkCode: number): boolean {
  return vkCode === 162 || vkCode === 163 // VK_LCONTROL, VK_RCONTROL
}

function clearCtrlHoldTimer(): void {
  if (ctrlHoldTimer !== null) {
    clearTimeout(ctrlHoldTimer)
    ctrlHoldTimer = null
  }
}

function cacheSelection(data: TextSelectionData): void {
  cachedSelection = { data, timestamp: Date.now() }
}

function consumeCachedSelection(): TextSelectionData | null {
  if (!cachedSelection) return null
  if (Date.now() - cachedSelection.timestamp > SELECTION_CACHE_TTL_MS) {
    cachedSelection = null
    return null
  }
  return cachedSelection.data
}

function invalidateSelectionCache(): void {
  cachedSelection = null
}

function handleKeyDownCtrlkeyMode(data: KeyboardEventData): void {
  if (!hookInstance) return
  if (!isCtrlKey(data.vkCode)) {
    clearCtrlHoldTimer()
    return
  }
  // Ignore the auto-repeat key-down stream while a single Ctrl hold is still
  // pending (timer armed) or has already shown the toolbar this hold.
  if (ctrlHoldTimer !== null || ctrlHoldHandled) return

  hookInstance.off('mouse-wheel', handleMouseWheelCtrlkeyMode)
  hookInstance.off('mouse-down', handleMouseDownCtrlkeyMode)
  hookInstance.on('mouse-wheel', handleMouseWheelCtrlkeyMode)
  hookInstance.on('mouse-down', handleMouseDownCtrlkeyMode)
  ctrlHoldTimer = setTimeout(() => {
    ctrlHoldTimer = null
    if (!hookInstance) return

    // Mark this hold as handled so the repeating key-down events that keep
    // arriving while Ctrl stays pressed don't re-arm the timer and re-show
    // the toolbar (flicker). Cleared on key-up.
    ctrlHoldHandled = true

    // Prefer cached selection from the last text-selection event (active mode).
    // Falls back to getCurrentSelection() when no cache exists (e.g. keyboard-
    // based selection that doesn't fire a text-selection event, or stale cache).
    let selectionData = consumeCachedSelection()
    if (!selectionData) {
      selectionData = hookInstance.getCurrentSelection()
    }

    if (selectionData) {
      const cursor = screen.getCursorScreenPoint()
      selectionData.mousePosEnd = cursor
      selectionData.mousePosStart = cursor
      showToolbarForSelection(selectionData)
    }
  }, 350)
}

function handleKeyUpCtrlkeyMode(data: KeyboardEventData): void {
  if (!hookInstance) return
  if (!isCtrlKey(data.vkCode)) return
  clearCtrlHoldTimer()
  ctrlHoldHandled = false
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
    ctrlHoldHandled = false
    isCtrlkeyListenerActive = false
  }

  // Always keep active mode so text-selection events fire even in ctrlkey mode.
  // In ctrlkey mode, handleTextSelection caches the data instead of showing
  // the toolbar, so the user experience is unchanged.
  try {
    hook.setSelectionPassiveMode(false)
  } catch (err) {
    console.warn('[SelectionService] setSelectionPassiveMode not supported:', err)
  }

  invalidateSelectionCache()

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
  invalidateSelectionCache()
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
