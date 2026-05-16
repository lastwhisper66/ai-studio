import {
  app,
  Tray,
  Menu,
  nativeImage,
  dialog,
  shell,
  type BrowserWindow,
  type MenuItemConstructorOptions,
} from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { IpcChannels } from '@shared/ipc-channels'
import { t } from './i18n'
import { getSetting } from './db'
import { getDataDir } from './utils/paths'
import { startScreenshot } from './screenshot'
import { checkForUpdates } from './auto-updater'
import { onSettingsChanged, writeSettingFromMain } from './settings-bus'
import { getSelectionAssistantEnabled } from './app-state'
import { toggleSelectionAssistant, refreshSelectionFilterConfig } from './selection-service'

export interface TrayDeps {
  /** 读 mainWindow 当前状态（决定 enabled / checked），允许返回 null。 */
  getMainWindow: () => BrowserWindow | null
  /** 触发动作时使用：若主窗不存在 / 已 destroy，由调用方调 createWindow() 并返回新实例。 */
  ensureMainWindow: () => BrowserWindow
  /** show + focus；由 index.ts 提供以避免循环 import。 */
  showWindow: (win: BrowserWindow) => void
}

let tray: Tray | null = null
let deps: TrayDeps | null = null
let unsubscribeSettings: (() => void) | null = null

const TRAY_RELEVANT_KEYS = new Set([
  'app.autoLaunch',
  'app.closeToTray',
  'app.startMinimized',
  'selection.enabled',
])

function isFlagTrue(key: string, defaultValue: boolean): boolean {
  const raw = getSetting(key)
  if (raw === undefined || raw === null || raw === '') return defaultValue
  return raw === 'true'
}

function buildMenuTemplate(): MenuItemConstructorOptions[] {
  if (!deps) return []

  const win = deps.getMainWindow()
  const hasWindow = win !== null
  const alwaysOnTop = hasWindow ? win!.isAlwaysOnTop() : false

  const autoLaunchOn = isFlagTrue('app.autoLaunch', false)
  const closeToTrayOn = getSetting('app.closeToTray') !== 'false' // 与 initCloseToTray 一致：默认 true
  const startMinimizedOn = isFlagTrue('app.startMinimized', false)
  const selectionOn = getSelectionAssistantEnabled()

  return [
    {
      label: t('tray.openMainWindow'),
      click: () => deps?.showWindow(deps.ensureMainWindow()),
    },
    {
      label: `${t('tray.newConversation')}\tCtrl+N`,
      click: () => {
        const w = deps?.ensureMainWindow()
        if (!w) return
        deps?.showWindow(w)
        w.webContents.send(IpcChannels.TRAY_NEW_CONVERSATION)
      },
    },
    {
      label: `${t('tray.screenshotTranslate')}\tAlt+P`,
      click: () => startScreenshot(),
    },
    { type: 'separator' },
    {
      label: `${t('tray.enableSelectionAssistant')}\tAlt+H`,
      type: 'checkbox',
      checked: selectionOn,
      click: () => {
        const enabled = toggleSelectionAssistant()
        const mw = deps?.getMainWindow()
        if (mw && !mw.isDestroyed()) {
          mw.webContents.send(IpcChannels.SELECTION_STATE_CHANGED, enabled)
        }
        refreshSelectionFilterConfig()
        updateTrayMenu()
      },
    },
    {
      label: t('tray.alwaysOnTop'),
      type: 'checkbox',
      checked: alwaysOnTop,
      enabled: hasWindow,
      click: () => {
        const mw = deps?.getMainWindow()
        if (!mw) return
        mw.setAlwaysOnTop(!mw.isAlwaysOnTop())
        // 'always-on-top-changed' 监听会触发 updateTrayMenu
      },
    },
    { type: 'separator' },
    {
      label: is.dev ? t('tray.autoLaunchDevDisabled') : t('tray.autoLaunch'),
      type: 'checkbox',
      checked: autoLaunchOn,
      enabled: !is.dev,
      click: () => writeSettingFromMain('app.autoLaunch', autoLaunchOn ? 'false' : 'true'),
    },
    {
      label: t('tray.closeToTray'),
      type: 'checkbox',
      checked: closeToTrayOn,
      click: () => writeSettingFromMain('app.closeToTray', closeToTrayOn ? 'false' : 'true'),
    },
    {
      label: t('tray.startMinimized'),
      type: 'checkbox',
      checked: startMinimizedOn,
      click: () => writeSettingFromMain('app.startMinimized', startMinimizedOn ? 'false' : 'true'),
    },
    { type: 'separator' },
    {
      label: `${t('tray.openSettings')}\tCtrl+,`,
      click: () => {
        const w = deps?.ensureMainWindow()
        if (!w) return
        deps?.showWindow(w)
        w.webContents.send(IpcChannels.TRAY_NAVIGATE_SETTINGS, {})
      },
    },
    {
      label: t('tray.settingsAndMaintenance'),
      submenu: [
        {
          label: t('tray.checkUpdate'),
          click: () => {
            const w = deps?.ensureMainWindow()
            if (w) {
              deps?.showWindow(w)
              w.webContents.send(IpcChannels.TRAY_NAVIGATE_SETTINGS, { section: 'about' })
            }
            void checkForUpdates(true)
          },
        },
        {
          label: t('tray.openDataDir'),
          click: () => {
            void shell.openPath(getDataDir())
          },
        },
        {
          label: t('tray.about'),
          click: () => {
            void dialog.showMessageBox({
              type: 'info',
              title: t('dialog.about.title'),
              message: 'AI Studio',
              detail: `${t('dialog.about.detail')}\nv${app.getVersion()}`,
            })
          },
        },
      ],
    },
    { type: 'separator' },
    {
      label: t('tray.version', { version: app.getVersion() }),
      enabled: false,
    },
    {
      label: t('tray.quit'),
      click: () => {
        // app.quit() 触发 before-quit；index.ts 的 before-quit 处理器会把
        // isQuitting 置 true，close 回调因此不会再走 hide 分支。
        app.quit()
      },
    },
  ]
}

export function createTray(d: TrayDeps): void {
  if (tray) return
  deps = d
  const iconPath = join(app.getAppPath(), 'resources', 'icon.png')
  const trayIcon = nativeImage.createFromPath(iconPath)
  tray = new Tray(trayIcon)
  tray.setToolTip('AI Studio')
  tray.on('click', () => {
    if (!deps) return
    const w = deps.ensureMainWindow()
    deps.showWindow(w)
  })
  updateTrayMenu()

  unsubscribeSettings = onSettingsChanged((entries) => {
    for (const key of Object.keys(entries)) {
      if (TRAY_RELEVANT_KEYS.has(key)) {
        updateTrayMenu()
        return
      }
    }
  })
}

export function updateTrayMenu(): void {
  if (!tray || tray.isDestroyed()) return
  const contextMenu = Menu.buildFromTemplate(buildMenuTemplate())
  tray.setContextMenu(contextMenu)
}

export function destroyTray(): void {
  if (unsubscribeSettings) {
    unsubscribeSettings()
    unsubscribeSettings = null
  }
  tray?.destroy()
  tray = null
  deps = null
}
