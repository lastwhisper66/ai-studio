import { BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { IpcChannels } from '@shared/ipc-channels'
import type { AutoExecutePayload } from '@shared/types'
import { abortQuickAssistant } from './ipc/quick-assistant-handlers'
import { getSetting } from './db'

let quickAssistantWindow: BrowserWindow | null = null
let contentReady = false
let pinned = false
let pendingAutoExecutePayload: AutoExecutePayload | null = null

/**
 * Delay (ms) before restoring window opacity after show().
 * On Windows, transparent BrowserWindows may briefly flash their old
 * content if made visible before the compositor has
 * composited the new frame. A short opacity-0 → opacity-1 transition
 * gives the GPU time to prepare. 60 ms covers most hardware; on very
 * slow machines this may still flash, but a longer delay would feel
 * sluggish for everyone else.
 */
const SHOW_OPACITY_DELAY_MS = 60

/** Read the user's default-pinned preference from DB. */
function isDefaultPinned(): boolean {
  return getSetting('quickAssistant.defaultPinned') === 'true'
}

/** Push the current pinned state to the renderer so its UI reflects main. */
function sendPinnedState(): void {
  if (!quickAssistantWindow || quickAssistantWindow.isDestroyed()) return
  quickAssistantWindow.webContents.send(IpcChannels.QUICK_ASSISTANT_STATE_CHANGED, { pinned })
}

/**
 * Pre-create the Quick Assistant window (hidden) at app startup.
 * The page loads and React renders in the background so that
 * the first toggle is an instant show() with no flash.
 */
export function preCreateQuickAssistantWindow(): void {
  if (quickAssistantWindow && !quickAssistantWindow.isDestroyed()) return

  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  quickAssistantWindow = new BrowserWindow({
    width: 600,
    height: 500,
    x: Math.round((width - 600) / 2),
    y: Math.round((height - 500) / 2),
    frame: false,
    resizable: false,
    alwaysOnTop: isDefaultPinned(),
    skipTaskbar: true,
    show: false,
    transparent: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  quickAssistantWindow.on('blur', () => {
    if (pinned) return
    abortQuickAssistant()
    quickAssistantWindow?.hide()
  })

  quickAssistantWindow.on('closed', () => {
    abortQuickAssistant()
    quickAssistantWindow = null
    contentReady = false
    pinned = false
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    quickAssistantWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?mode=quick-assistant`)
  } else {
    quickAssistantWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { mode: 'quick-assistant' },
    })
  }
}

export function toggleQuickAssistantWindow(): void {
  if (quickAssistantWindow && !quickAssistantWindow.isDestroyed()) {
    if (quickAssistantWindow.isVisible()) {
      // Reset pin so the blur handler runs its abort logic
      pinned = false
      quickAssistantWindow.hide()
    } else if (contentReady) {
      // Restore pin state from default setting each time the window is shown
      const defaultPin = isDefaultPinned()
      pinned = defaultPin
      quickAssistantWindow.setAlwaysOnTop(defaultPin)
      sendPinnedState()
      // Re-center on primary display each time it's shown
      const { width, height } = screen.getPrimaryDisplay().workAreaSize
      quickAssistantWindow.setBounds({
        x: Math.round((width - 600) / 2),
        y: Math.round((height - 500) / 2),
        width: 600,
        height: 500,
      })
      // Prevent transparent-window flash on Windows: show invisible first,
      // let the compositor prepare the content, then reveal.
      quickAssistantWindow.setOpacity(0)
      quickAssistantWindow.show()
      quickAssistantWindow.focus()
      setTimeout(() => {
        if (quickAssistantWindow && !quickAssistantWindow.isDestroyed()) {
          quickAssistantWindow.setOpacity(1)
        }
      }, SHOW_OPACITY_DELAY_MS)
    }
    // If not contentReady yet, just ignore — page is still loading
  } else {
    // Window was destroyed (shouldn't normally happen); recreate
    preCreateQuickAssistantWindow()
  }
}

export function hideQuickAssistantWindow(): void {
  if (quickAssistantWindow && !quickAssistantWindow.isDestroyed()) {
    quickAssistantWindow.hide()
  }
}

/**
 * Show the quick assistant window and automatically execute an action
 * with the given payload (e.g. screenshot image + image-translate action).
 * The payload is stored and pulled by the renderer via IPC when it's ready.
 */
export function showQuickAssistantWithAutoExecute(payload: AutoExecutePayload): void {
  if (!quickAssistantWindow || quickAssistantWindow.isDestroyed() || !contentReady) return

  // Store payload for the renderer to pull when ready
  pendingAutoExecutePayload = payload

  // Only reset pin/alwaysOnTop when transitioning from hidden to visible.
  // If the window is already visible, preserve the user's current pin override.
  if (!quickAssistantWindow.isVisible()) {
    const defaultPin = isDefaultPinned()
    pinned = defaultPin
    quickAssistantWindow.setAlwaysOnTop(defaultPin)
    sendPinnedState()
  }

  // Re-center on primary display
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  quickAssistantWindow.setBounds({
    x: Math.round((width - 600) / 2),
    y: Math.round((height - 500) / 2),
    width: 600,
    height: 500,
  })

  // Show with opacity transition (same as toggle)
  quickAssistantWindow.setOpacity(0)
  quickAssistantWindow.show()
  quickAssistantWindow.focus()
  setTimeout(() => {
    if (quickAssistantWindow && !quickAssistantWindow.isDestroyed()) {
      quickAssistantWindow.setOpacity(1)
    }
  }, SHOW_OPACITY_DELAY_MS)
}

export function initQuickAssistantIpc(): void {
  ipcMain.on(IpcChannels.QUICK_ASSISTANT_CLOSE, () => {
    hideQuickAssistantWindow()
  })

  // Renderer signals that React + data loading is complete
  ipcMain.on(IpcChannels.QUICK_ASSISTANT_READY, () => {
    contentReady = true
  })

  // Renderer toggles pinned state (keeps window visible on blur + always on top)
  ipcMain.on(IpcChannels.QUICK_ASSISTANT_SET_PINNED, (_event, value: boolean) => {
    pinned = value
    if (quickAssistantWindow && !quickAssistantWindow.isDestroyed()) {
      quickAssistantWindow.setAlwaysOnTop(value)
    }
  })

  // Renderer pulls pending auto-execute payload (set by screenshot flow)
  ipcMain.handle(IpcChannels.QUICK_ASSISTANT_GET_PENDING_AUTO_EXECUTE, () => {
    const payload = pendingAutoExecutePayload
    pendingAutoExecutePayload = null
    return { success: true, data: payload }
  })
}
