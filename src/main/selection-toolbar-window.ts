import { BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { IpcChannels } from '@shared/ipc-channels'
import type { SelectionAnchor, SelectionToolbarPayload } from '@shared/types'

let toolbarWindow: BrowserWindow | null = null
let contentReady = false
let pendingPayload: SelectionToolbarPayload | null = null

/** See quick-assistant-window.ts — same opacity trick to avoid Win32 transparent-flash. */
const SHOW_OPACITY_DELAY_MS = 60
const TOOLBAR_WIDTH = 280
const TOOLBAR_HEIGHT = 44
/** Vertical gap between the selection region and the toolbar */
const TOOLBAR_OFFSET_Y = 4

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
    width: TOOLBAR_WIDTH,
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
function computeToolbarBounds(anchor: SelectionAnchor): Electron.Rectangle {
  const display = screen.getDisplayNearestPoint({
    x: Math.round(anchor.x + anchor.width / 2),
    y: Math.round(anchor.y + anchor.height / 2),
  })
  const area = display.workArea

  let x = Math.round(anchor.x)
  let y = Math.round(anchor.y + anchor.height + TOOLBAR_OFFSET_Y)

  // Clamp horizontally
  const maxX = area.x + area.width - TOOLBAR_WIDTH
  if (x > maxX) x = maxX
  if (x < area.x) x = area.x

  // If the toolbar would extend below the work area, flip above the selection
  if (y + TOOLBAR_HEIGHT > area.y + area.height) {
    y = Math.round(anchor.y - TOOLBAR_HEIGHT - TOOLBAR_OFFSET_Y)
  }
  if (y < area.y) y = area.y

  return { x, y, width: TOOLBAR_WIDTH, height: TOOLBAR_HEIGHT }
}

export function showSelectionToolbar(payload: SelectionToolbarPayload): void {
  if (!toolbarWindow || toolbarWindow.isDestroyed()) {
    preCreateSelectionToolbarWindow()
  }
  const win = toolbarWindow
  if (!win) return

  pendingPayload = payload
  win.setBounds(computeToolbarBounds(payload.anchor))

  if (contentReady) {
    win.webContents.send(IpcChannels.SELECTION_TOOLBAR_DATA, payload)
  }

  // Opacity transition to avoid transparent-window flash on Windows
  win.setOpacity(0)
  win.showInactive()
  setTimeout(() => {
    if (win && !win.isDestroyed()) {
      win.setOpacity(1)
    }
  }, SHOW_OPACITY_DELAY_MS)
}

export function hideSelectionToolbar(): void {
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

  ipcMain.on(IpcChannels.SELECTION_TOOLBAR_ACTION, (_event, actionId: string) => {
    if (!pendingPayload) return
    const payload = pendingPayload
    // Clear first so a rapid second IPC (double-click, stuck event) can't
    // fire the same action twice for a single selection.
    pendingPayload = null
    hideSelectionToolbar()
    onActionClick?.(actionId, payload)
  })
}
