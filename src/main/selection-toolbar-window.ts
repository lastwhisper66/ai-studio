import { BrowserWindow, ipcMain, screen, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { IpcChannels } from '@shared/ipc-channels'
import type { SelectionAction, SelectionAnchor, SelectionToolbarPayload } from '@shared/types'
import { getSetting } from './db/settings'

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
      const { protocol } = new URL(custom.replace('{query}', 'test'))
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

let toolbarWindow: BrowserWindow | null = null
let contentReady = false
let pendingPayload: SelectionToolbarPayload | null = null
let opacityFallbackTimer: NodeJS.Timeout | null = null

/** See quick-assistant-window.ts — same opacity trick to avoid Win32 transparent-flash. */
const TOOLBAR_MIN_WIDTH = 120
const TOOLBAR_MAX_WIDTH = 720
const TOOLBAR_DEFAULT_WIDTH = 280
const TOOLBAR_HEIGHT = 44
/** Vertical gap between the selection region and the toolbar */
const TOOLBAR_OFFSET_Y = 4
/**
 * If the renderer fails to report a measured width (e.g. it crashed or the
 * payload arrived before it was ready), fall back to showing the window at
 * max width after this timeout. Better to reveal an oversized toolbar than a
 * frozen transparent one.
 */
const RESIZE_FALLBACK_MS = 200

/**
 * Width heuristic used only as a fallback. The renderer reports the real
 * DOM-measured width via `SELECTION_TOOLBAR_RESIZE` right after paint, so this
 * initial size is just a safe upper bound while the first frame is laying out.
 */
function initialToolbarWidth(actions: SelectionAction[]): number {
  if (actions.length === 0) return TOOLBAR_DEFAULT_WIDTH
  return TOOLBAR_MAX_WIDTH
}

let onActionClick: ((actionId: string, payload: SelectionToolbarPayload) => void) | null = null

/** Register the action handler invoked when a toolbar button is clicked. */
export function setSelectionToolbarActionHandler(
  handler: (actionId: string, payload: SelectionToolbarPayload) => void,
): void {
  onActionClick = handler
}

export function preCreateSelectionToolbarWindow(): void {
  if (toolbarWindow && !toolbarWindow.isDestroyed()) return

  toolbarWindow = new BrowserWindow({
    width: TOOLBAR_DEFAULT_WIDTH,
    height: TOOLBAR_HEIGHT,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    // Critical: do NOT steal focus from the app the user just selected in —
    // otherwise the selection may be cleared before the user can click.
    focusable: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  toolbarWindow.setAlwaysOnTop(true, 'screen-saver')

  toolbarWindow.on('closed', () => {
    toolbarWindow = null
    contentReady = false
    pendingPayload = null
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    toolbarWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?mode=selection-toolbar`)
  } else {
    toolbarWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { mode: 'selection-toolbar' },
    })
  }
}

/** Clamp the toolbar position to the work area of the display containing `anchor`. */
function computeToolbarBounds(anchor: SelectionAnchor, width: number): Electron.Rectangle {
  const display = screen.getDisplayNearestPoint({
    x: Math.round(anchor.x + anchor.width / 2),
    y: Math.round(anchor.y + anchor.height / 2),
  })
  const area = display.workArea

  let x = Math.round(anchor.x)
  let y = Math.round(anchor.y + anchor.height + TOOLBAR_OFFSET_Y)

  // Clamp horizontally
  const maxX = area.x + area.width - width
  if (x > maxX) x = maxX
  if (x < area.x) x = area.x

  // If the toolbar would extend below the work area, flip above the selection
  if (y + TOOLBAR_HEIGHT > area.y + area.height) {
    y = Math.round(anchor.y - TOOLBAR_HEIGHT - TOOLBAR_OFFSET_Y)
  }
  if (y < area.y) y = area.y

  return { x, y, width, height: TOOLBAR_HEIGHT }
}

export function showSelectionToolbar(payload: SelectionToolbarPayload): void {
  if (!toolbarWindow || toolbarWindow.isDestroyed()) {
    preCreateSelectionToolbarWindow()
  }
  const win = toolbarWindow
  if (!win) return

  pendingPayload = payload
  // Lay out at a safe upper bound with opacity 0. The renderer measures the
  // real content width right after paint and calls selectionToolbarResize,
  // which tightens the bounds and flips opacity to 1 — so users never see the
  // oversized box. See SELECTION_TOOLBAR_RESIZE handler below.
  win.setBounds(computeToolbarBounds(payload.anchor, initialToolbarWidth(payload.actions)))
  win.setOpacity(0)
  win.showInactive()

  if (contentReady) {
    win.webContents.send(IpcChannels.SELECTION_TOOLBAR_DATA, payload)
  }

  // Fallback: if the renderer never reports a measurement (crash, IPC drop),
  // reveal the window anyway rather than leaving it invisible forever.
  if (opacityFallbackTimer) clearTimeout(opacityFallbackTimer)
  opacityFallbackTimer = setTimeout(() => {
    opacityFallbackTimer = null
    if (win && !win.isDestroyed() && win.isVisible()) {
      win.setOpacity(1)
    }
  }, RESIZE_FALLBACK_MS)
}

export function hideSelectionToolbar(): void {
  if (opacityFallbackTimer) {
    clearTimeout(opacityFallbackTimer)
    opacityFallbackTimer = null
  }
  if (toolbarWindow && !toolbarWindow.isDestroyed() && toolbarWindow.isVisible()) {
    toolbarWindow.hide()
  }
}

/**
 * Return the current toolbar bounds (DIP) if visible, else null.
 * Used to decide whether an outside mouse-down should dismiss it.
 */
export function getVisibleToolbarBounds(): Electron.Rectangle | null {
  if (!toolbarWindow || toolbarWindow.isDestroyed() || !toolbarWindow.isVisible()) {
    return null
  }
  return toolbarWindow.getBounds()
}

/** Return the last payload that was shown (used by bubble to look up text/anchor). */
export function getPendingToolbarPayload(): SelectionToolbarPayload | null {
  return pendingPayload
}

export function initSelectionToolbarIpc(): void {
  ipcMain.on(IpcChannels.SELECTION_TOOLBAR_READY, () => {
    contentReady = true
    // If a payload arrived before the renderer was ready, flush it now
    if (pendingPayload && toolbarWindow && !toolbarWindow.isDestroyed()) {
      toolbarWindow.webContents.send(IpcChannels.SELECTION_TOOLBAR_DATA, pendingPayload)
    }
  })

  ipcMain.on(IpcChannels.SELECTION_TOOLBAR_CLOSE, () => {
    hideSelectionToolbar()
  })

  ipcMain.on(IpcChannels.SELECTION_TOOLBAR_RESIZE, (_event, width: number) => {
    if (!toolbarWindow || toolbarWindow.isDestroyed() || !toolbarWindow.isVisible()) return
    if (!pendingPayload) return
    if (!Number.isFinite(width) || width <= 0) return
    const clamped = Math.max(TOOLBAR_MIN_WIDTH, Math.min(TOOLBAR_MAX_WIDTH, Math.ceil(width)))
    toolbarWindow.setBounds(computeToolbarBounds(pendingPayload.anchor, clamped))
    toolbarWindow.setOpacity(1)
    if (opacityFallbackTimer) {
      clearTimeout(opacityFallbackTimer)
      opacityFallbackTimer = null
    }
  })

  ipcMain.on(IpcChannels.SELECTION_TOOLBAR_ACTION, (_event, actionId: string) => {
    if (!pendingPayload) return
    const payload = pendingPayload
    // Clear first so a rapid second IPC (double-click, stuck event) can't
    // fire the same action twice for a single selection.
    pendingPayload = null
    hideSelectionToolbar()
    onActionClick?.(actionId, payload)
  })

  ipcMain.on(IpcChannels.SELECTION_TOOLBAR_SEARCH, (_event, text: string) => {
    if (!text) return
    pendingPayload = null
    hideSelectionToolbar()
    const url = buildSearchUrl(text)
    try {
      const { protocol } = new URL(url)
      if (!ALLOWED_PROTOCOLS.includes(protocol)) return
    } catch {
      return
    }
    shell.openExternal(url).catch((err) => {
      console.warn('[SelectionToolbar] openExternal failed:', err)
    })
  })
}
