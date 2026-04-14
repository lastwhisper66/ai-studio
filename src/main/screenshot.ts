import { BrowserWindow, ipcMain, nativeImage, screen } from 'electron'
import { join } from 'path'
import { Monitor } from 'node-screenshots'
import { is } from '@electron-toolkit/utils'
import { IpcChannels } from '@shared/ipc-channels'
import type { ScreenshotCompletePayload, FileData } from '@shared/types'
import { showQuickAssistantWithAutoExecute } from './quick-assistant-window'

let overlayWindow: BrowserWindow | null = null
let capturedImageBuffer: Buffer | null = null
let captureScaleFactor = 1
let hiddenMainWindow: BrowserWindow | null = null

function destroyOverlay(): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.destroy()
  }
  overlayWindow = null
  capturedImageBuffer = null
  captureScaleFactor = 1
}

function restoreMainWindow(): void {
  if (hiddenMainWindow && !hiddenMainWindow.isDestroyed()) {
    hiddenMainWindow.show()
  }
  hiddenMainWindow = null
}

/**
 * Capture the screen on the given display and show the selection overlay.
 */
function captureScreen(targetDisplay: Electron.Display): void {
  try {
    const monitors = Monitor.all()
    const monitor =
      monitors.find((m) => m.x() === targetDisplay.bounds.x && m.y() === targetDisplay.bounds.y) ??
      monitors[0]

    if (!monitor) {
      console.error('[Screenshot] No monitor found')
      restoreMainWindow()
      return
    }

    const image = monitor.captureImageSync()
    capturedImageBuffer = Buffer.from(image.toPngSync())
    captureScaleFactor = targetDisplay.scaleFactor
    const base64 = capturedImageBuffer.toString('base64')

    const { bounds } = targetDisplay

    overlayWindow = new BrowserWindow({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      frame: false,
      // Do NOT use transparent: true — on Windows, layered (transparent) windows
      // cannot reliably cover the taskbar. The canvas already fills the entire
      // viewport with the captured image, so window-level transparency is unnecessary.
      skipTaskbar: true,
      resizable: false,
      movable: false,
      fullscreenable: false,
      show: false,
      backgroundColor: '#000000',
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    })

    overlayWindow.on('closed', () => {
      overlayWindow = null
    })

    // 'screen-saver' is the highest z-order level, ensuring coverage over the taskbar
    overlayWindow.setAlwaysOnTop(true, 'screen-saver')

    // Load screenshot mode
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      overlayWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?mode=screenshot`)
    } else {
      overlayWindow.loadFile(join(__dirname, '../renderer/index.html'), {
        query: { mode: 'screenshot' },
      })
    }

    overlayWindow.webContents.once('did-finish-load', () => {
      if (!overlayWindow || overlayWindow.isDestroyed()) return
      // Send the screenshot data to the overlay
      overlayWindow.webContents.send(IpcChannels.SCREENSHOT_DATA, {
        base64,
        width: image.width,
        height: image.height,
        displayWidth: bounds.width,
        displayHeight: bounds.height,
        scaleFactor: captureScaleFactor,
      })
      overlayWindow.show()
      // Force full-display bounds after show — Windows may clamp the window
      // to the work area (excluding taskbar) during initial placement.
      overlayWindow.setBounds({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      })
      overlayWindow.focus()
    })
  } catch (err) {
    console.error('[Screenshot] Capture failed:', err)
    destroyOverlay()
    restoreMainWindow()
  }
}

export function startScreenshot(mainWindow: BrowserWindow | null): void {
  // Prevent multiple overlays
  if (overlayWindow && !overlayWindow.isDestroyed()) return

  // Determine which display the cursor is on
  const cursorPoint = screen.getCursorScreenPoint()
  const targetDisplay = screen.getDisplayNearestPoint(cursorPoint)

  // Hide application windows so they don't appear in the screenshot
  hiddenMainWindow = null
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
    mainWindow.once('hide', () => captureScreen(targetDisplay))
    mainWindow.hide()
    hiddenMainWindow = mainWindow
  } else {
    captureScreen(targetDisplay)
  }
}

export function initScreenshotIpc(): void {
  ipcMain.on(IpcChannels.SCREENSHOT_COMPLETE, (_event, payload: ScreenshotCompletePayload) => {
    try {
      if (!capturedImageBuffer) {
        console.error('[Screenshot] No captured image available')
        destroyOverlay()
        restoreMainWindow()
        return
      }

      const { x, y, width, height } = payload
      if (width <= 0 || height <= 0) {
        destroyOverlay()
        restoreMainWindow()
        return
      }

      // Crop using Electron nativeImage from the stored buffer (captured before overlay appeared)
      // This avoids re-capturing the screen which would include the overlay itself
      const fullImage = nativeImage.createFromBuffer(capturedImageBuffer)
      const scaleFactor = captureScaleFactor
      const cropped = fullImage.crop({
        x: Math.round(x * scaleFactor),
        y: Math.round(y * scaleFactor),
        width: Math.round(width * scaleFactor),
        height: Math.round(height * scaleFactor),
      })
      const croppedBuffer = cropped.toPNG()
      const croppedBase64 = croppedBuffer.toString('base64')

      const fileData: FileData = {
        name: `screenshot-${Date.now()}.png`,
        mimeType: 'image/png',
        base64: croppedBase64,
        size: croppedBuffer.length,
      }

      destroyOverlay()
      restoreMainWindow()

      // Show quick assistant and auto-execute image translate
      showQuickAssistantWithAutoExecute({
        files: [fileData],
        actionId: 'builtin-image-translate',
      })
    } catch (err) {
      console.error('[Screenshot] Crop failed:', err)
      destroyOverlay()
      restoreMainWindow()
    }
  })

  ipcMain.on(IpcChannels.SCREENSHOT_CANCEL, () => {
    destroyOverlay()
    restoreMainWindow()
  })
}
