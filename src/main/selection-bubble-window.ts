import { BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { IpcChannels } from '@shared/ipc-channels'
import type { SelectionAnchor, SelectionBubblePayload } from '@shared/types'
import { getSetting } from './db'
import { createWindowSizePersistor } from './utils/window-size-persist'

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
/** Vertical gap between the anchor and the bubble (slightly larger than toolbar) */
const BUBBLE_OFFSET_Y = 6

const sizePersistor = createWindowSizePersistor({
  widthKey: 'selection.bubbleWidth',
  heightKey: 'selection.bubbleHeight',
  defaultWidth: 420,
  defaultHeight: 320,
  minWidth: 360,
  minHeight: 240,
  logPrefix: '[SelectionBubble]',
})

/** Read the user's default-pinned preference from DB. */
function isDefaultPinned(): boolean {
  return getSetting('selection.defaultPinned') === 'true'
}

export function preCreateSelectionBubbleWindow(): void {
  if (bubbleWindow && !bubbleWindow.isDestroyed()) return

  const { width, height } = sizePersistor.load()

  bubbleWindow = new BrowserWindow({
    width,
    height,
    minWidth: 360,
    minHeight: 240,
    frame: false,
    transparent: true,
    resizable: true,
    skipTaskbar: true,
    alwaysOnTop: isDefaultPinned(),
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  bubbleWindow.on('blur', () => {
    // When pinned, the user wants the bubble to stay visible across focus changes.
    if (pinned) return
    // Don't kill an in-flight stream just because focus briefly shifted.
    if (streaming) return
    hideSelectionBubble()
  })

  sizePersistor.attach(bubbleWindow)

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

function computeBubbleBounds(
  anchor: SelectionAnchor,
  size: { width: number; height: number },
): Electron.Rectangle {
  const display = screen.getDisplayNearestPoint({
    x: Math.round(anchor.x + anchor.width / 2),
    y: Math.round(anchor.y + anchor.height / 2),
  })
  const area = display.workArea

  let x = Math.round(anchor.x)
  let y = Math.round(anchor.y + anchor.height + BUBBLE_OFFSET_Y)

  // Clamp order matters: apply the min last so a bubble wider than the work
  // area (edge case on very small displays) still sticks to the left edge
  // rather than leaking off the right.
  const maxX = area.x + area.width - size.width
  x = Math.max(area.x, Math.min(maxX, x))

  // If bubble would overflow the work area bottom, flip above the anchor
  if (y + size.height > area.y + area.height) {
    y = Math.round(anchor.y - size.height - BUBBLE_OFFSET_Y)
  }
  if (y < area.y) y = area.y

  return { x, y, width: size.width, height: size.height }
}

export function showSelectionBubble(payload: Omit<SelectionBubblePayload, 'pinned'>): void {
  if (!bubbleWindow || bubbleWindow.isDestroyed()) {
    preCreateSelectionBubbleWindow()
  }
  const win = bubbleWindow
  if (!win) return

  // A new selection starts a fresh session — restore pin state from the user's
  // default setting (matching Quick Assistant behavior), and clear streaming.
  pinned = isDefaultPinned()
  streaming = false
  // Keep window z-order in sync with pinned — matches Quick Assistant semantics:
  // pinned controls both "stay on top" and "don't auto-close on blur".
  win.setAlwaysOnTop(pinned)
  const fullPayload: SelectionBubblePayload = { ...payload, pinned }
  pendingPayload = fullPayload
  // Use the window's current size so repositioning honors the user's last resize.
  const [width, height] = win.getSize()
  win.setBounds(computeBubbleBounds(payload.anchor, { width, height }))

  if (contentReady) {
    win.webContents.send(IpcChannels.SELECTION_BUBBLE_DATA, fullPayload)
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
    if (bubbleWindow && !bubbleWindow.isDestroyed()) {
      bubbleWindow.setAlwaysOnTop(pinned)
    }
  })

  ipcMain.on(IpcChannels.SELECTION_BUBBLE_SET_STREAMING, (_event, value: boolean) => {
    streaming = Boolean(value)
  })
}
