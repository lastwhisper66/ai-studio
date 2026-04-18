import { BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { IpcChannels } from '@shared/ipc-channels'
import type { SelectionAnchor, SelectionBubblePayload } from '@shared/types'

let bubbleWindow: BrowserWindow | null = null
let contentReady = false
let pendingPayload: SelectionBubblePayload | null = null
let pinned = false
/**
 * Tracks whether the bubble is actively streaming an AI response. While
 * true, losing focus (e.g. user clicks the scrollbar or another window
 * momentarily) must NOT dismiss the bubble — that would kill the in-flight
 * stream. The renderer notifies us via SELECTION_BUBBLE_SET_STREAMING.
 */
let streaming = false

/**
 * Called when the bubble is about to hide. The service layer registers a
 * handler here (via setSelectionBubbleHideHandler) so the window layer doesn't
 * need to reach into IPC code to abort in-flight streams.
 */
let onBubbleHide: (() => void) | null = null

export function setSelectionBubbleHideHandler(handler: (() => void) | null): void {
  onBubbleHide = handler
}

const SHOW_OPACITY_DELAY_MS = 60
const BUBBLE_WIDTH = 420
const BUBBLE_HEIGHT = 320
/** Vertical gap between the anchor and the bubble (slightly larger than toolbar) */
const BUBBLE_OFFSET_Y = 6

export function preCreateSelectionBubbleWindow(): void {
  if (bubbleWindow && !bubbleWindow.isDestroyed()) return

  bubbleWindow = new BrowserWindow({
    width: BUBBLE_WIDTH,
    height: BUBBLE_HEIGHT,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  bubbleWindow.setAlwaysOnTop(true, 'screen-saver')

  bubbleWindow.on('blur', () => {
    // When pinned, the user wants the bubble to stay visible across focus changes.
    if (pinned) return
    // Don't kill an in-flight stream just because focus briefly shifted.
    if (streaming) return
    hideSelectionBubble()
  })

  bubbleWindow.on('closed', () => {
    bubbleWindow = null
    contentReady = false
    pendingPayload = null
    pinned = false
    streaming = false
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    bubbleWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?mode=selection-bubble`)
  } else {
    bubbleWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { mode: 'selection-bubble' },
    })
  }
}

function computeBubbleBounds(anchor: SelectionAnchor): Electron.Rectangle {
  const display = screen.getDisplayNearestPoint({
    x: Math.round(anchor.x + anchor.width / 2),
    y: Math.round(anchor.y + anchor.height / 2),
  })
  const area = display.workArea

  let x = Math.round(anchor.x)
  let y = Math.round(anchor.y + anchor.height + BUBBLE_OFFSET_Y)

  const maxX = area.x + area.width - BUBBLE_WIDTH
  if (x > maxX) x = maxX
  if (x < area.x) x = area.x

  // If bubble would overflow the work area bottom, flip above the anchor
  if (y + BUBBLE_HEIGHT > area.y + area.height) {
    y = Math.round(anchor.y - BUBBLE_HEIGHT - BUBBLE_OFFSET_Y)
  }
  if (y < area.y) y = area.y

  return { x, y, width: BUBBLE_WIDTH, height: BUBBLE_HEIGHT }
}

export function showSelectionBubble(payload: SelectionBubblePayload): void {
  if (!bubbleWindow || bubbleWindow.isDestroyed()) {
    preCreateSelectionBubbleWindow()
  }
  const win = bubbleWindow
  if (!win) return

  pendingPayload = payload
  // A new selection starts a fresh session — reset pin/streaming flags from any prior view
  pinned = false
  streaming = false
  win.setBounds(computeBubbleBounds(payload.anchor))

  if (contentReady) {
    win.webContents.send(IpcChannels.SELECTION_BUBBLE_DATA, payload)
  }

  win.setOpacity(0)
  win.show()
  win.focus()
  setTimeout(() => {
    if (win && !win.isDestroyed()) {
      win.setOpacity(1)
    }
  }, SHOW_OPACITY_DELAY_MS)
}

export function hideSelectionBubble(): void {
  if (bubbleWindow && !bubbleWindow.isDestroyed() && bubbleWindow.isVisible()) {
    bubbleWindow.hide()
    // Notify the service layer so it can abort any in-flight stream.
    onBubbleHide?.()
  }
  // Hiding ends the current bubble session — clear flags so the next show starts fresh
  pinned = false
  streaming = false
}

export function initSelectionBubbleIpc(): void {
  ipcMain.on(IpcChannels.SELECTION_BUBBLE_READY, () => {
    contentReady = true
    if (pendingPayload && bubbleWindow && !bubbleWindow.isDestroyed()) {
      bubbleWindow.webContents.send(IpcChannels.SELECTION_BUBBLE_DATA, pendingPayload)
    }
  })

  ipcMain.on(IpcChannels.SELECTION_BUBBLE_CLOSE, () => {
    hideSelectionBubble()
  })

  ipcMain.on(IpcChannels.SELECTION_BUBBLE_SET_PINNED, (_event, value: boolean) => {
    pinned = Boolean(value)
  })

  ipcMain.on(IpcChannels.SELECTION_BUBBLE_SET_STREAMING, (_event, value: boolean) => {
    streaming = Boolean(value)
  })
}
