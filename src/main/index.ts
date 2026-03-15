import { app, shell, BrowserWindow, screen } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { IpcChannels } from '@shared/ipc-channels'
import { initDatabase, closeDatabase } from './db'
import { registerAllIpcHandlers } from './ipc'

// ── Window state persistence ────────────────────────────────────

interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  isMaximized: boolean
}

const defaultState: WindowState = { width: 1200, height: 800, isMaximized: false }

function getWindowStatePath(): string {
  const appDir = app.isPackaged ? dirname(app.getPath('exe')) : app.getAppPath()
  return join(appDir, 'data', 'window-state.json')
}

function loadWindowState(): WindowState {
  try {
    const raw = readFileSync(getWindowStatePath(), 'utf-8')
    return { ...defaultState, ...JSON.parse(raw) }
  } catch {
    return { ...defaultState }
  }
}

function saveWindowState(win: BrowserWindow): void {
  const state: WindowState = {
    isMaximized: win.isMaximized(),
    ...win.getNormalBounds(),
  }
  try {
    const dir = dirname(getWindowStatePath())
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(getWindowStatePath(), JSON.stringify(state))
  } catch {
    // Non-critical — silently ignore write errors
  }
}

// ── Window creation ─────────────────────────────────────────────

function createWindow(): void {
  const restored = loadWindowState()

  // Validate that the saved position is still on a connected display
  const usePosition =
    restored.x !== undefined &&
    restored.y !== undefined &&
    screen.getAllDisplays().some((display) => {
      const { x, y, width, height } = display.bounds
      return (
        restored.x! >= x && restored.x! < x + width && restored.y! >= y && restored.y! < y + height
      )
    })

  const mainWindow = new BrowserWindow({
    width: restored.width,
    height: restored.height,
    ...(usePosition ? { x: restored.x, y: restored.y } : {}),
    minWidth: 800,
    minHeight: 600,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    if (restored.isMaximized) {
      mainWindow.maximize()
    }
    mainWindow.show()
  })

  // Persist window state on close
  mainWindow.on('close', () => {
    saveWindowState(mainWindow)
  })

  // Notify renderer of maximize/unmaximize state changes
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send(IpcChannels.WINDOW_MAXIMIZED_CHANGE, true)
  })
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send(IpcChannels.WINDOW_MAXIMIZED_CHANGE, false)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Block DevTools and refresh shortcuts in production
  if (!is.dev) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      const key = input.key.toLowerCase()
      if (
        input.key === 'F12' ||
        input.key === 'F5' ||
        (input.control && input.shift && key === 'i') ||
        (input.control && key === 'r')
      ) {
        event.preventDefault()
      }
    })
  }

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ── Single instance lock ────────────────────────────────────────

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.ai-studio.app')

    initDatabase()
    registerAllIpcHandlers()

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  closeDatabase()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
