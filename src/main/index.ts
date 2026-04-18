import {
  app,
  shell,
  BrowserWindow,
  screen,
  globalShortcut,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  dialog,
} from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { IpcChannels } from '@shared/ipc-channels'
import { ZOOM_STEP, ZOOM_DEFAULT, clampZoom } from '@shared/zoom'
import { initDatabase, closeDatabase } from './db'
import { getSetting, setSetting } from './db'
import { registerAllIpcHandlers } from './ipc'
import { applySslSetting } from './ai'
import { DEFAULT_KEYBINDINGS, type KeybindingActionId } from '@shared/keybindings'
import {
  initCloseToTray,
  getCloseToTray,
  getStartMinimized,
  initStartMinimized,
  initAutoLaunch,
  initSpellCheck,
  getQuickAssistantEnabled,
  initQuickAssistant,
  getSelectionAssistantEnabled,
} from './app-state'
import { getDataDir } from './utils/paths'
import {
  toggleQuickAssistantWindow,
  initQuickAssistantIpc,
  preCreateQuickAssistantWindow,
} from './quick-assistant-window'
import { startScreenshot, initScreenshotIpc } from './screenshot'
import {
  preCreateSelectionToolbarWindow,
  initSelectionToolbarIpc,
} from './selection-toolbar-window'
import { preCreateSelectionBubbleWindow, initSelectionBubbleIpc } from './selection-bubble-window'
import {
  cleanupSelectionService,
  initSelectionService,
  refreshSelectionFilterConfig,
  toggleSelectionAssistant,
} from './selection-service'

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
  return join(getDataDir(), 'window-state.json')
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

// ── Zoom helpers ───────────────────────────────────────────────

/** Convert DOM-style accelerator to Electron globalShortcut format */
function toElectronAccelerator(accel: string): string {
  return accel
    .split('+')
    .map((part) => {
      switch (part) {
        case ' ':
          return 'Space'
        case 'ArrowUp':
          return 'Up'
        case 'ArrowDown':
          return 'Down'
        case 'ArrowLeft':
          return 'Left'
        case 'ArrowRight':
          return 'Right'
        case 'Escape':
          return 'Esc'
        default:
          return part
      }
    })
    .join('+')
}

function getSummonWindowAccelerator(): string {
  const raw = getSetting('app.keybindings')
  let overrides: Partial<Record<KeybindingActionId, string>> = {}
  if (raw) {
    try {
      overrides = JSON.parse(raw)
    } catch {
      // ignore
    }
  }
  return overrides['summon-window'] ?? DEFAULT_KEYBINDINGS['summon-window'].defaultAccelerator
}

let currentSummonShortcut: string | null = null

function registerSummonWindowShortcut(): void {
  if (currentSummonShortcut) {
    globalShortcut.unregister(currentSummonShortcut)
    currentSummonShortcut = null
  }

  const accel = getSummonWindowAccelerator()
  const electronAccel = toElectronAccelerator(accel)

  const ok = globalShortcut.register(electronAccel, () => {
    if (mainWindow) showWindow(mainWindow)
  })

  if (ok) {
    currentSummonShortcut = electronAccel
  } else if (is.dev) {
    console.warn(`Failed to register global shortcut ${electronAccel} — may already be in use`)
  }
}

function getQuickAssistantAccelerator(): string {
  const raw = getSetting('app.keybindings')
  let overrides: Partial<Record<KeybindingActionId, string>> = {}
  if (raw) {
    try {
      overrides = JSON.parse(raw)
    } catch {
      // ignore
    }
  }
  return (
    overrides['toggle-quick-assistant'] ??
    DEFAULT_KEYBINDINGS['toggle-quick-assistant'].defaultAccelerator
  )
}

let currentQaShortcut: string | null = null

function registerQuickAssistantShortcut(): void {
  // Unregister previous shortcut
  if (currentQaShortcut) {
    globalShortcut.unregister(currentQaShortcut)
    currentQaShortcut = null
  }

  const accel = getQuickAssistantAccelerator()
  const electronAccel = toElectronAccelerator(accel)

  const ok = globalShortcut.register(electronAccel, () => {
    if (!getQuickAssistantEnabled()) return
    toggleQuickAssistantWindow()
  })

  if (ok) {
    currentQaShortcut = electronAccel
  } else if (is.dev) {
    console.warn(`Failed to register global shortcut ${electronAccel} — may already be in use`)
  }
}

function getScreenshotAccelerator(): string {
  const raw = getSetting('app.keybindings')
  let overrides: Partial<Record<KeybindingActionId, string>> = {}
  if (raw) {
    try {
      overrides = JSON.parse(raw)
    } catch {
      // ignore
    }
  }
  return (
    overrides['screenshot-translate'] ??
    DEFAULT_KEYBINDINGS['screenshot-translate'].defaultAccelerator
  )
}

let currentScreenshotShortcut: string | null = null

function registerScreenshotShortcut(): void {
  if (currentScreenshotShortcut) {
    globalShortcut.unregister(currentScreenshotShortcut)
    currentScreenshotShortcut = null
  }

  const accel = getScreenshotAccelerator()
  const electronAccel = toElectronAccelerator(accel)

  const ok = globalShortcut.register(electronAccel, () => {
    startScreenshot(mainWindow)
  })

  if (ok) {
    currentScreenshotShortcut = electronAccel
  } else if (is.dev) {
    console.warn(`Failed to register global shortcut ${electronAccel} — may already be in use`)
  }
}

function getSelectionToggleAccelerator(): string {
  const raw = getSetting('app.keybindings')
  let overrides: Partial<Record<KeybindingActionId, string>> = {}
  if (raw) {
    try {
      overrides = JSON.parse(raw)
    } catch {
      // ignore
    }
  }
  return (
    overrides['toggle-selection-assistant'] ??
    DEFAULT_KEYBINDINGS['toggle-selection-assistant'].defaultAccelerator
  )
}

let currentSelectionToggleShortcut: string | null = null

function registerSelectionToggleShortcut(): boolean {
  if (currentSelectionToggleShortcut) {
    globalShortcut.unregister(currentSelectionToggleShortcut)
    currentSelectionToggleShortcut = null
  }

  const accel = getSelectionToggleAccelerator()
  const electronAccel = toElectronAccelerator(accel)

  const ok = globalShortcut.register(electronAccel, () => {
    const enabled = toggleSelectionAssistant()
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IpcChannels.SELECTION_STATE_CHANGED, enabled)
    }
    updateTrayMenu()
  })

  if (ok) {
    currentSelectionToggleShortcut = electronAccel
  } else if (is.dev) {
    console.warn(`Failed to register global shortcut ${electronAccel} — may already be in use`)
  }
  return ok
}

function changeZoom(win: BrowserWindow, delta: number): void {
  const current = win.webContents.getZoomFactor()
  const next = clampZoom(current + delta)
  win.webContents.setZoomFactor(next)
  win.webContents.send(IpcChannels.WINDOW_ZOOM_CHANGED, next)
  setSetting('display.zoomFactor', String(next))
}

function resetZoom(win: BrowserWindow): void {
  win.webContents.setZoomFactor(ZOOM_DEFAULT)
  win.webContents.send(IpcChannels.WINDOW_ZOOM_CHANGED, ZOOM_DEFAULT)
  setSetting('display.zoomFactor', String(ZOOM_DEFAULT))
}

// ── Window creation ─────────────────────────────────────────────

let isQuitting = false
let tray: Tray | null = null
let mainWindow: BrowserWindow | null = null

function showWindow(win: BrowserWindow): void {
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

function updateTrayMenu(): void {
  if (!tray || tray.isDestroyed()) return
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开主窗口',
      click: () => {
        if (mainWindow) showWindow(mainWindow)
      },
    },
    { type: 'separator' },
    {
      label: '启用划词助手',
      type: 'checkbox',
      checked: getSelectionAssistantEnabled(),
      click: () => {
        const enabled = toggleSelectionAssistant()
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IpcChannels.SELECTION_STATE_CHANGED, enabled)
        }
        updateTrayMenu()
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

  const win = new BrowserWindow({
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
  mainWindow = win

  win.on('ready-to-show', () => {
    // Restore saved zoom factor
    const savedZoom = getSetting('display.zoomFactor')
    if (savedZoom) {
      const factor = parseFloat(savedZoom)
      if (!isNaN(factor)) {
        const clamped = clampZoom(factor)
        win.webContents.setZoomFactor(clamped)
        win.webContents.send(IpcChannels.WINDOW_ZOOM_CHANGED, clamped)
      }
    }

    if (!getStartMinimized()) {
      if (restored.isMaximized) {
        win.maximize()
      }
      win.show()
    }
  })

  // Close behavior: hide to tray or quit, controlled by app.closeToTray setting
  win.on('close', (e) => {
    try {
      saveWindowState(win)
    } catch {
      // Non-critical — silently ignore
    }
    if (!isQuitting) {
      const closeToTray = getCloseToTray()
      if (closeToTray) {
        e.preventDefault()
        win.hide()
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
  win.on('maximize', () => {
    win.webContents.send(IpcChannels.WINDOW_MAXIMIZED_CHANGE, true)
  })
  win.on('unmaximize', () => {
    win.webContents.send(IpcChannels.WINDOW_MAXIMIZED_CHANGE, false)
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Intercept shortcuts before IME processing (works regardless of input method)
  win.webContents.on('before-input-event', (event, input) => {
    const key = input.key.toLowerCase()

    // Zoom shortcuts: Ctrl+Plus, Ctrl+Minus, Ctrl+0
    if (input.control && !input.shift && !input.alt) {
      if (key === '+' || key === '=') {
        event.preventDefault()
        changeZoom(win, ZOOM_STEP)
        return
      }
      if (key === '-') {
        event.preventDefault()
        changeZoom(win, -ZOOM_STEP)
        return
      }
      if (key === '0') {
        event.preventDefault()
        resetZoom(win)
        return
      }
    }

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
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ── Single instance lock ────────────────────────────────────────

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) showWindow(mainWindow)
  })

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.ai-studio.app')

    initDatabase()
    applySslSetting()
    initCloseToTray()
    initStartMinimized()
    initAutoLaunch()
    initSpellCheck()
    initQuickAssistant()
    registerAllIpcHandlers()
    initQuickAssistantIpc()
    initScreenshotIpc()
    initSelectionToolbarIpc()
    initSelectionBubbleIpc()

    // IPC: re-register quick assistant shortcut when user changes it
    ipcMain.handle(IpcChannels.QUICK_ASSISTANT_UPDATE_SHORTCUT, () => {
      registerQuickAssistantShortcut()
      return { success: true }
    })

    ipcMain.handle(IpcChannels.SUMMON_WINDOW_UPDATE_SHORTCUT, () => {
      registerSummonWindowShortcut()
      return { success: true }
    })

    ipcMain.handle(IpcChannels.SCREENSHOT_UPDATE_SHORTCUT, () => {
      registerScreenshotShortcut()
      return { success: true }
    })

    ipcMain.handle(IpcChannels.SELECTION_UPDATE_SHORTCUT, () => {
      const registered = registerSelectionToggleShortcut()
      return { success: true, data: { registered } }
    })

    ipcMain.handle(IpcChannels.SELECTION_TOGGLE, () => {
      const enabled = toggleSelectionAssistant()
      updateTrayMenu()
      return { success: true, data: enabled }
    })

    ipcMain.handle(IpcChannels.SELECTION_REFRESH_FILTER, () => {
      refreshSelectionFilterConfig()
      return { success: true }
    })

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    createWindow()

    // Pre-create Quick Assistant window (hidden) so the first toggle is instant
    preCreateQuickAssistantWindow()
    // Pre-create selection toolbar + bubble so the first selection is instant
    preCreateSelectionToolbarWindow()
    preCreateSelectionBubbleWindow()
    // Start the selection-hook (if enabled) only after the two windows exist
    initSelectionService()

    // Global shortcut: summon the main window (user-configurable, default Alt+A)
    registerSummonWindowShortcut()

    // Global shortcut: Ctrl+Shift+Space to toggle Quick Assistant (user-configurable)
    registerQuickAssistantShortcut()

    // Global shortcut: Alt+P to trigger screenshot translate (user-configurable)
    registerScreenshotShortcut()

    // Global shortcut: Alt+H to toggle Selection Assistant (user-configurable)
    registerSelectionToggleShortcut()

    // ── System tray ───────────────────────────────────────────────
    const iconPath = join(app.getAppPath(), 'resources', 'icon.png')
    const trayIcon = nativeImage.createFromPath(iconPath)
    tray = new Tray(trayIcon)
    tray.setToolTip('AI Studio')
    updateTrayMenu()

    tray.on('click', () => {
      if (mainWindow) showWindow(mainWindow)
    })

    app.on('activate', () => {
      if (!mainWindow || mainWindow.isDestroyed()) createWindow()
    })
  })
}

// On macOS, apps conventionally stay active until Cmd+Q.
// On Windows, the close handler hides to tray; this fires only when
// all windows are destroyed (e.g. during a true quit).
app.on('before-quit', () => {
  isQuitting = true
  cleanupSelectionService()
})

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll()
  tray?.destroy()
  closeDatabase()
  app.quit()
})
