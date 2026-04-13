import { BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { IpcChannels } from '@shared/ipc-channels'
import { abortQuickAssistant } from './ipc/quick-assistant-handlers'

let quickAssistantWindow: BrowserWindow | null = null
let contentReady = false

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
    alwaysOnTop: true,
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
    abortQuickAssistant()
    quickAssistantWindow?.hide()
  })

  quickAssistantWindow.on('closed', () => {
    abortQuickAssistant()
    quickAssistantWindow = null
    contentReady = false
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
      quickAssistantWindow.hide()
    } else if (contentReady) {
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

export function initQuickAssistantIpc(): void {
  ipcMain.on(IpcChannels.QUICK_ASSISTANT_CLOSE, () => {
    hideQuickAssistantWindow()
  })

  // Renderer signals that React + data loading is complete
  ipcMain.on(IpcChannels.QUICK_ASSISTANT_READY, () => {
    contentReady = true
  })
}
