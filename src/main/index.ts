import {
  app,
  shell,
  BrowserWindow,
  screen,
  globalShortcut,
  Tray,
  Menu,
  nativeImage,
  dialog,
} from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { IpcChannels } from '@shared/ipc-channels'
import { initDatabase, closeDatabase } from './db'
import { registerAllIpcHandlers } from './ipc'
import { applySslSetting } from './ai'
import { initCloseToTray, getCloseToTray } from './app-state'

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

let isQuitting = false
let tray: Tray | null = null

function showWindow(win: BrowserWindow): void {
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

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

  const iconPath = join(app.getAppPath(), 'resources', 'icon.png')

  const mainWindow = new BrowserWindow({
    width: restored.width,
    height: restored.height,
    ...(usePosition ? { x: restored.x, y: restored.y } : {}),
    minWidth: 800,
    minHeight: 600,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    icon: iconPath,
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

  // Close behavior: hide to tray or quit, controlled by app.closeToTray setting
  mainWindow.on('close', (e) => {
    try {
      saveWindowState(mainWindow)
    } catch {
      // Non-critical — silently ignore
    }
    if (!isQuitting) {
      const closeToTray = getCloseToTray()
      if (closeToTray) {
        e.preventDefault()
        mainWindow.hide()
        return
      }
    }
    try {
      closeDatabase()
    } finally {
      app.exit(0)
    }
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

  // Intercept shortcuts before IME processing (works regardless of input method)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const key = input.key.toLowerCase()

    // Block DevTools and refresh shortcuts in production
    if (
      !is.dev &&
      (input.key === 'F12' ||
        input.key === 'F5' ||
        (input.control && input.shift && key === 'i') ||
        (input.control && key === 'r'))
    ) {
      event.preventDefault()
    }
  })

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
    if (win) showWindow(win)
  })

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.ai-studio.app')

    initDatabase()
    applySslSetting()
    initCloseToTray()
    registerAllIpcHandlers()

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    createWindow()

    // Global shortcut: Ctrl+Win+A to summon the main window
    const registered = globalShortcut.register('Ctrl+Super+A', () => {
      const win = BrowserWindow.getAllWindows()[0]
      if (win) showWindow(win)
    })
    if (!registered && is.dev) {
      console.warn('Failed to register global shortcut Ctrl+Super+A — may already be in use')
    }

    // ── System tray ───────────────────────────────────────────────
    const iconPath = join(app.getAppPath(), 'resources', 'icon.png')
    const trayIcon = nativeImage.createFromPath(iconPath)
    tray = new Tray(trayIcon)
    tray.setToolTip('AI Studio')

    const contextMenu = Menu.buildFromTemplate([
      {
        label: '打开主窗口',
        click: () => {
          const win = BrowserWindow.getAllWindows()[0]
          if (win) showWindow(win)
        },
      },
      { type: 'separator' },
      {
        label: '关于',
        click: () => {
          dialog.showMessageBox({
            type: 'info',
            title: '关于 AI Studio',
            message: `AI Studio v${app.getVersion()}`,
            detail: 'A desktop AI chat application',
          })
        },
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          isQuitting = true
          app.quit()
        },
      },
    ])
    tray.setContextMenu(contextMenu)

    tray.on('click', () => {
      const win = BrowserWindow.getAllWindows()[0]
      if (win) showWindow(win)
    })

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

// On macOS, apps conventionally stay active until Cmd+Q.
// On Windows, the close handler hides to tray; this fires only when
// all windows are destroyed (e.g. during a true quit).
app.on('before-quit', () => {
  isQuitting = true
})

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll()
  tray?.destroy()
  closeDatabase()
  app.quit()
})
