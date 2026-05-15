# Tray Context Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把托盘右键菜单从 4 项扩展为 14 项 + 1 个子菜单，覆盖快速操作 / 开关 / 设置入口；并把 settings 副作用与广播抽出为独立模块，让 tray 能订阅"任意设置变化"自动刷新 checkbox。

**Architecture:**
- 新建 3 个 main 进程模块：`tray.ts`（菜单实例 + 行为）/ `settings-bus.ts`（main 进程内的设置事件总线）/ `settings-side-effects.ts`（apply* dispatch 表）。
- 新增 2 个 IPC channel (`tray:new-conversation` / `tray:navigate-settings`) 让 main 把用户点击转发给 renderer 触发新建会话 / 跳设置页。
- 设置变化通过 `settings-bus` 的 EventEmitter 触发 `updateTrayMenu()`，避免循环依赖。

**Tech Stack:** Electron 39 (Tray / Menu / nativeImage / dialog / shell) + TypeScript strict + i18next + Conventional Commits。项目无单元测试框架，验证回路为 `npm run typecheck` + `npm run lint` + `npm run dev` 手测。

**Spec:** `docs/superpowers/specs/2026-05-15-tray-context-menu-design.md`

---

## File Structure

新建：
- `src/main/settings-side-effects.ts` — `applyZoomSetting` / `applyLanguageSetting` / `settingSideEffects` dispatch 表 / `applySideEffects`
- `src/main/settings-bus.ts` — `applyAndBroadcast` / `writeSettingFromMain` / `writeSettingsFromMain` / `onSettingsChanged` + 内部 `broadcastToRenderers` 与 `EventEmitter`
- `src/main/tray.ts` — `createTray` / `updateTrayMenu` / `destroyTray`；module-internal Tray 实例、TrayDeps、菜单构造、点击 handler

修改：
- `src/main/ipc/settings-handlers.ts` — 删除 module-private 副作用/广播逻辑，handler 改为薄壳
- `src/main/index.ts` — 删除内联 tray 代码，改调 `createTray(...)`；追加 `'always-on-top-changed'` / `'closed'` 回调的 `updateTrayMenu()` 调用
- `src/shared/ipc-channels.ts` — 新增 2 个常量
- `src/preload/index.ts` — 新增 2 个订阅 API
- `src/renderer/src/App.tsx` — `useEffect` 订阅 2 个 channel
- `src/renderer/src/i18n/locales/zh-CN.json` — 扩 tray 段
- `src/renderer/src/i18n/locales/en.json` — 扩 tray 段

任务依赖：Task 1 → Task 2（settings-bus 依赖 side-effects）；Task 2 → Task 5（tray 订阅 bus）；Task 3 / Task 4 与 Task 5 并行可行但顺序写下；Task 5 → Task 6（index.ts 接入）；Task 7 → Task 8（preload 在前，renderer 在后）；Task 9 收尾。

---

## Task 1: 抽出 settings-side-effects.ts

**Files:**
- Create: `src/main/settings-side-effects.ts`
- Modify: `src/main/ipc/settings-handlers.ts`

- [ ] **Step 1: 创建 settings-side-effects.ts，把 settings-handlers.ts 第 19-67 行的逻辑迁过来**

新建 `src/main/settings-side-effects.ts`：

```ts
import { BrowserWindow } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import { clampZoom } from '@shared/zoom'
import { applySslSetting } from './ai'
import { setMainLanguage, LANGUAGE_SETTING_KEY } from './i18n'
import {
  applyCloseToTraySetting,
  applyAutoLaunchSetting,
  applySpellCheckSetting,
  applyStartMinimizedSetting,
  applyQuickAssistantEnabled,
  applyAutoUpdateEnabledSetting,
} from './app-state'
import { backupSyncService } from './backup/sync-service'

function applyZoomSetting(value: string): void {
  const factor = parseFloat(value)
  if (isNaN(factor)) return
  const clamped = clampZoom(factor)
  const win = BrowserWindow.getAllWindows()[0]
  if (win) {
    win.webContents.setZoomFactor(clamped)
    win.webContents.send(IpcChannels.WINDOW_ZOOM_CHANGED, clamped)
  }
}

function applyLanguageSetting(value: string): void {
  setMainLanguage(value)
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(IpcChannels.SETTINGS_LANGUAGE_CHANGED, value)
    }
  }
}

const settingSideEffects: Record<string, (value: string) => void> = {
  'app.skipSslVerify': (v) => applySslSetting(v === 'true'),
  'app.closeToTray': applyCloseToTraySetting,
  'app.autoLaunch': applyAutoLaunchSetting,
  'app.spellCheck': applySpellCheckSetting,
  'app.startMinimized': applyStartMinimizedSetting,
  'app.autoUpdateEnabled': applyAutoUpdateEnabledSetting,
  'display.zoomFactor': applyZoomSetting,
  'quickAssistant.enabled': applyQuickAssistantEnabled,
  'backup.remote.webdav.autoSyncIntervalMinutes': () => backupSyncService.scheduleAuto('webdav'),
  'backup.remote.s3.autoSyncIntervalMinutes': () => backupSyncService.scheduleAuto('s3'),
  [LANGUAGE_SETTING_KEY]: applyLanguageSetting,
}

export function applySideEffects(key: string, value: string): void {
  settingSideEffects[key]?.(value)
  if (key.startsWith('backup.remote.') || key === 'backup.lastLocalChangeAt') {
    backupSyncService.broadcastStatus()
  }
}
```

- [ ] **Step 2: 修改 settings-handlers.ts，删除迁出的代码并改 import**

替换 `src/main/ipc/settings-handlers.ts` 第 1-67 行：

```ts
import { ipcMain, BrowserWindow } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type { IpcResult } from '@shared/types'
import { getSetting, setSetting, setSettingsBatch, getAllSettings } from '../db'
import { toLocalizedError } from '../errors'
import { applySideEffects } from '../settings-side-effects'

function broadcastSettingsChanged(entries: Record<string, string>, senderId?: number): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    if (senderId !== undefined && win.webContents.id === senderId) continue
    win.webContents.send(IpcChannels.SETTINGS_CHANGED, entries)
  }
}
```

第 77 行起的 `registerSettingsHandlers` 内部保持原样不变（仍调 `applySideEffects` + `broadcastSettingsChanged`）。

- [ ] **Step 3: typecheck**

Run: `npm run typecheck`

Expected: PASS（applySideEffects 现在从新模块 import，dispatch 行为不变）

- [ ] **Step 4: lint + format**

Run: `npm run lint && npm run format`

Expected: 无错误。

- [ ] **Step 5: Commit**

```bash
git add src/main/settings-side-effects.ts src/main/ipc/settings-handlers.ts
git commit -m "refactor: extract settings side effects into dedicated module"
```

---

## Task 2: 新增 settings-bus.ts 与 handler 改造

**Files:**
- Create: `src/main/settings-bus.ts`
- Modify: `src/main/ipc/settings-handlers.ts`

- [ ] **Step 1: 创建 settings-bus.ts**

新建 `src/main/settings-bus.ts`：

```ts
import { EventEmitter } from 'events'
import { BrowserWindow } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import { setSetting, setSettingsBatch } from './db'
import { applySideEffects } from './settings-side-effects'

const emitter = new EventEmitter()

function broadcastToRenderers(entries: Record<string, string>, excludeSenderId?: number): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    if (excludeSenderId !== undefined && win.webContents.id === excludeSenderId) continue
    win.webContents.send(IpcChannels.SETTINGS_CHANGED, entries)
  }
}

/**
 * 副作用 + 跨 renderer 广播 + 主进程内事件；**不写库**。
 * IPC handler 调本函数（已经在 IPC 入口写过库），主进程内写设置用 writeSettingFromMain。
 */
export function applyAndBroadcast(
  entries: Record<string, string>,
  excludeSenderId?: number,
): void {
  for (const [k, v] of Object.entries(entries)) applySideEffects(k, v)
  broadcastToRenderers(entries, excludeSenderId)
  emitter.emit('changed', entries)
}

/** 主进程内主动写设置：写库 + applyAndBroadcast。 */
export function writeSettingFromMain(key: string, value: string): void {
  setSetting(key, value)
  applyAndBroadcast({ [key]: value })
}

export function writeSettingsFromMain(entries: Record<string, string>): void {
  setSettingsBatch(entries)
  applyAndBroadcast(entries)
}

export function onSettingsChanged(
  handler: (entries: Record<string, string>) => void,
): () => void {
  emitter.on('changed', handler)
  return () => emitter.off('changed', handler)
}
```

- [ ] **Step 2: 改造 settings-handlers.ts，使用 applyAndBroadcast 替换内部 applySideEffects + broadcastSettingsChanged**

替换 `src/main/ipc/settings-handlers.ts` 全文：

```ts
import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type { IpcResult } from '@shared/types'
import { getSetting, setSetting, setSettingsBatch, getAllSettings } from '../db'
import { toLocalizedError } from '../errors'
import { applyAndBroadcast } from '../settings-bus'

export function registerSettingsHandlers(): void {
  ipcMain.handle(IpcChannels.SETTINGS_GET, (_, key: string): IpcResult<string | undefined> => {
    try {
      const data = getSetting(key)
      return { success: true, data }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(
    IpcChannels.SETTINGS_SET,
    (event, key: string, value: string): IpcResult<void> => {
      try {
        setSetting(key, value)
        applyAndBroadcast({ [key]: value }, event.sender.id)
        return { success: true }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(IpcChannels.SETTINGS_GET_ALL, (): IpcResult<Record<string, string>> => {
    try {
      const data = getAllSettings()
      return { success: true, data }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(
    IpcChannels.SETTINGS_SET_BATCH,
    (event, entries: Record<string, string>): IpcResult<void> => {
      try {
        setSettingsBatch(entries)
        applyAndBroadcast(entries, event.sender.id)
        return { success: true }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )
}
```

- [ ] **Step 3: typecheck + lint + format**

Run: `npm run typecheck && npm run lint && npm run format`

Expected: PASS。settings-handlers 不再持有 broadcast / dispatch 实现；handler 入参签名不变。

- [ ] **Step 4: 手测 settings 变化广播仍然正常**

Run: `npm run dev`

打开 dev → 设置 → General → 切换"关闭时隐藏到托盘"开关，观察主窗 close 行为变化（hide 而不退出）；再切回，观察变化。如果两种状态均按预期工作，说明 `applySideEffects` 与 `broadcastSettingsChanged` 替换路径正确。

- [ ] **Step 5: Commit**

```bash
git add src/main/settings-bus.ts src/main/ipc/settings-handlers.ts
git commit -m "refactor: introduce settings-bus for main-process setting writes"
```

---

## Task 3: 新增 IPC channel 常量

**Files:**
- Modify: `src/shared/ipc-channels.ts`

- [ ] **Step 1: 加 2 个常量**

在 `src/shared/ipc-channels.ts` 找到 `SETTINGS_CHANGED: 'settings:changed',` 这一行后面（或最末尾合适位置）加：

```ts
  // Tray (main → renderer push)
  TRAY_NEW_CONVERSATION: 'tray:new-conversation',
  TRAY_NAVIGATE_SETTINGS: 'tray:navigate-settings',
```

放置位置：建议放在 `SETTINGS_*` 那一段尾部，紧贴 `SETTINGS_CHANGED`。

- [ ] **Step 2: typecheck**

Run: `npm run typecheck`

Expected: PASS（仅常量新增）

- [ ] **Step 3: Commit**

```bash
git add src/shared/ipc-channels.ts
git commit -m "ipc: add tray:new-conversation and tray:navigate-settings channels"
```

---

## Task 4: 扩充 tray i18n 文案

**Files:**
- Modify: `src/renderer/src/i18n/locales/zh-CN.json`
- Modify: `src/renderer/src/i18n/locales/en.json`

- [ ] **Step 1: 替换 zh-CN.json 的 tray 段**

定位到 `src/renderer/src/i18n/locales/zh-CN.json` 第 901 行起的 tray 段，整段替换为：

```json
  "tray": {
    "openMainWindow": "打开主窗口",
    "newConversation": "新建会话",
    "screenshotTranslate": "开始截图翻译",
    "enableSelectionAssistant": "启用划词助手",
    "alwaysOnTop": "始终置顶主窗",
    "autoLaunch": "开机自启",
    "autoLaunchDevDisabled": "开机自启（开发模式不可用）",
    "closeToTray": "关闭时隐藏到托盘",
    "startMinimized": "启动时最小化到托盘",
    "openSettings": "打开设置",
    "settingsAndMaintenance": "设置与维护",
    "checkUpdate": "检查更新",
    "openDataDir": "打开数据目录",
    "about": "关于 AI Studio",
    "version": "v{{version}}",
    "quit": "退出"
  },
```

- [ ] **Step 2: 替换 en.json 的 tray 段**

```json
  "tray": {
    "openMainWindow": "Open main window",
    "newConversation": "New conversation",
    "screenshotTranslate": "Screenshot translate",
    "enableSelectionAssistant": "Enable selection assistant",
    "alwaysOnTop": "Always on top",
    "autoLaunch": "Launch on startup",
    "autoLaunchDevDisabled": "Launch on startup (disabled in dev)",
    "closeToTray": "Close to tray",
    "startMinimized": "Start minimized to tray",
    "openSettings": "Open settings",
    "settingsAndMaintenance": "Settings & maintenance",
    "checkUpdate": "Check for updates",
    "openDataDir": "Open data folder",
    "about": "About AI Studio",
    "version": "v{{version}}",
    "quit": "Quit"
  },
```

- [ ] **Step 3: format**

Run: `npm run format`

Expected: prettier 处理两个 JSON。

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/i18n/locales/zh-CN.json src/renderer/src/i18n/locales/en.json
git commit -m "i18n: expand tray namespace for new context menu items"
```

---

## Task 5: 新建 tray.ts 核心模块

**Files:**
- Create: `src/main/tray.ts`

- [ ] **Step 1: 创建 tray.ts**

新建 `src/main/tray.ts`：

```ts
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
import {
  getSelectionAssistantEnabled,
  toggleSelectionAssistant,
  refreshSelectionFilterConfig,
} from './selection-service'

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
        // 这里不能直接调 app.quit()：需要 isQuitting 标记。
        // 由 deps 提供退出回调更稳，但为了最小化接口，本菜单直接发送 'before-quit'
        // 让 index.ts 的 before-quit 监听处理。app.quit() 是异步的，before-quit
        // 钩子会先触发并允许 index.ts 设置 isQuitting = true。
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
```

- [ ] **Step 2: 确认 selection-service 导出**

`tray.ts` import 了 `refreshSelectionFilterConfig`。打开 `src/main/selection-service.ts` 确认该函数存在并已 export。如果不存在但有等价名称（grep 已确认 index.ts:555 调用 `refreshSelectionFilterConfig`，所以存在），跳过；否则改用实际导出名。

Run: `grep -n "^export.*refreshSelectionFilter" src/main/selection-service.ts`

Expected: 输出对应行。

- [ ] **Step 3: typecheck**

Run: `npm run typecheck`

Expected: PASS。如有 import 报错，对照真实 selection-service 导出名修正即可。

- [ ] **Step 4: lint + format**

Run: `npm run lint && npm run format`

Expected: 无错误。

- [ ] **Step 5: Commit**

```bash
git add src/main/tray.ts
git commit -m "feat(tray): extract tray module with extended context menu"
```

---

## Task 6: 改 index.ts 接入 tray 模块

**Files:**
- Modify: `src/main/index.ts`

- [ ] **Step 1: 删除内联 tray 代码并接入新模块**

打开 `src/main/index.ts`，做四处编辑：

(a) 顶部 `electron` import：去掉 `Tray` 与 `Menu` 与 `nativeImage` 与 `dialog`（如果它们除 tray 外没有其它使用；用 grep 确认）；如果它们还有其它使用则保留。同时增加：

```ts
import { createTray, updateTrayMenu, destroyTray } from './tray'
```

(b) 删除变量声明（第 279 行附近）：
```ts
let tray: Tray | null = null
```

(c) 删除整个 `updateTrayMenu` 函数（第 288-332 行）。

(d) 找到原有的"System tray"区段（第 589-598 行附近），替换为：

```ts
    // ── System tray ───────────────────────────────────────────────
    createTray({
      getMainWindow: () => mainWindow,
      ensureMainWindow: () => {
        if (!mainWindow || mainWindow.isDestroyed()) createWindow()
        return mainWindow!
      },
      showWindow,
    })
```

(e) 找到 `app.on('window-all-closed', ...)`（第 614-619 行附近），把 `tray?.destroy()` 替换为 `destroyTray()`：

```ts
app.on('window-all-closed', () => {
  globalShortcut.unregisterAll()
  destroyTray()
  closeDatabase()
  app.quit()
})
```

- [ ] **Step 2: mainWindow 事件回调中追加 updateTrayMenu**

找到第 421 行的 `win.on('always-on-top-changed', ...)`，改为：

```ts
  win.on('always-on-top-changed', (_event, isAlwaysOnTop) => {
    win.webContents.send(IpcChannels.WINDOW_ALWAYS_ON_TOP_CHANGE, isAlwaysOnTop)
    updateTrayMenu()
  })
```

在 `createWindow()` 内、`win.on('close', ...)` 之后增加 `'closed'` 监听（如已存在则在内部追加 `updateTrayMenu()`）：

```ts
  win.on('closed', () => {
    mainWindow = null
    updateTrayMenu()
  })
```

如果文件里已经有 `mainWindow = win` 与 close 处理但没有 `'closed'` 监听，则补上即可。

- [ ] **Step 3: 验证移除项无其它引用**

Run: `grep -n "new Tray\|tray\.setContextMenu\|tray\.setToolTip\|tray = " src/main/index.ts`

Expected: 无输出（说明 inline tray 代码已彻底移除）。

- [ ] **Step 4: typecheck + lint + format**

Run: `npm run typecheck && npm run lint && npm run format`

Expected: PASS。

- [ ] **Step 5: 手测**

Run: `npm run dev`

测试要点：
1. 启动后，托盘图标可见，左键打开主窗。
2. 托盘右键 → 出现 14 行 + "设置与维护"子菜单。
3. 点"打开主窗口"，主窗显示并聚焦。
4. 切换"始终置顶主窗" → 主窗顶部行为变化；菜单 checkbox 立即同步。
5. 切换"关闭时隐藏到托盘" → 设置页 General 段的对应开关同步变化（验证 settings-bus 双向同步）。
6. 切换"启用划词助手" → 设置页 Selection Assistant 段同步；划词功能开/关。
7. "开机自启"显示 disabled + "（开发模式不可用）"后缀。
8. 点"开始截图翻译" → 进入区域选择 overlay；取消选择应回到原状。
9. 点"打开数据目录" → 系统资源管理器打开 `./data` 文件夹。
10. 点子菜单"关于 AI Studio" → 弹窗，detail 包含 `v<version>`。
11. 点"v<version>" 非交互项 → 无反应。
12. 点"退出" → app 完全退出（不只是 hide）。

如果第 12 项不成功（点退出后只 hide）：检查 `before-quit` 监听是否仍把 `isQuitting` 置 true。看 `src/main/index.ts` 现有的 `app.on('before-quit', ...)`（约第 609 行），它应当设置 `isQuitting = true`。tray 菜单点退出后 → `app.quit()` → before-quit 触发 → isQuitting = true → close handler 不再走 hide 分支。如果该链断了，加：

```ts
app.on('before-quit', () => {
  isQuitting = true
})
```

- [ ] **Step 6: Commit**

```bash
git add src/main/index.ts
git commit -m "feat(main): wire tray module and refresh hooks"
```

---

## Task 7: preload 暴露 tray 订阅 API

**Files:**
- Modify: `src/preload/index.ts`

- [ ] **Step 1: 加 2 个订阅函数**

在 `src/preload/index.ts` 中，找到 `onSelectionStateChanged`（约第 711 行）之后或紧邻 `onSettingsChanged`（约第 170 行），添加：

```ts
  // Tray
  onTrayNewConversation: (callback: () => void): (() => void) => {
    const handler = (): void => callback()
    ipcRenderer.on(IpcChannels.TRAY_NEW_CONVERSATION, handler)
    return () => ipcRenderer.removeListener(IpcChannels.TRAY_NEW_CONVERSATION, handler)
  },

  onTrayNavigateSettings: (
    callback: (payload: { section?: string }) => void,
  ): (() => void) => {
    const handler = (
      _e: Electron.IpcRendererEvent,
      payload: { section?: string },
    ): void => callback(payload ?? {})
    ipcRenderer.on(IpcChannels.TRAY_NAVIGATE_SETTINGS, handler)
    return () => ipcRenderer.removeListener(IpcChannels.TRAY_NAVIGATE_SETTINGS, handler)
  },
```

`section` 用 `string` 类型（运行时由 renderer 内部 cast 为 `SettingsSection`），避免 preload 引入 renderer-only 的类型依赖。

- [ ] **Step 2: typecheck**

Run: `npm run typecheck`

Expected: PASS。preload 由 `tsconfig.node.json` 编译。

- [ ] **Step 3: format**

Run: `npm run format`

- [ ] **Step 4: Commit**

```bash
git add src/preload/index.ts
git commit -m "preload: expose tray subscription APIs"
```

---

## Task 8: renderer 订阅 tray IPC

**Files:**
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: 在 App 组件内加 useEffect 订阅两个 channel**

在 `src/renderer/src/App.tsx` 内，找到现有的 focus / keybinding init useEffect 块（约第 63-74 行），在它们之后插入：

```ts
  // Tray → renderer bridges: 新建会话 / 跳设置页
  useEffect(() => {
    const offNewConv = window.api.onTrayNewConversation(() => {
      const assistantId = useAssistantStore.getState().activeAssistantId ?? undefined
      void useConversationStore.getState().createConversation(undefined, assistantId)
    })
    const offNavSettings = window.api.onTrayNavigateSettings(({ section }) => {
      const validSections: ReadonlyArray<string> = [
        'provider',
        'model-library',
        'model-group',
        'general',
        'network',
        'display',
        'data',
        'phrases',
        'keyboard-shortcuts',
        'quick-assistant',
        'selection-assistant',
        'about',
      ]
      const target = section && validSections.includes(section) ? section : 'general'
      // target 已通过 whitelist 检查；cast 为 SettingsSection 字面量联合类型。
      // 不直接 import SettingsSection 是为了避免拖入额外的 renderer 内部依赖。
      useSettingsStore.getState().navigateToSettings(target as never)
    })
    return () => {
      offNewConv()
      offNavSettings()
    }
  }, [])
```

`createConversation` 第二个参数 `assistantId` 是当前激活 assistant id（与现有 Ctrl+N 快捷键流程对齐——见 `conversationStore.ts:436`）。

- [ ] **Step 2: typecheck**

Run: `npm run typecheck`

Expected: PASS。

- [ ] **Step 3: lint + format**

Run: `npm run lint && npm run format`

Expected: 无错误。

- [ ] **Step 4: 手测**

Run: `npm run dev`

测试要点：
1. 在主窗未聚焦时，托盘右键 → 新建会话 → 主窗显示并出现一个新会话。
2. 托盘右键 → 打开设置 → 主窗显示并切到设置页（默认 General）。
3. 托盘右键 → 设置与维护 → 检查更新 → 主窗显示并跳到关于页；右下角或关于面板里看到 updater 状态变化（dev 下应为 `not-available`）。
4. 重复 1-3，确认无重复订阅（每次都只触发一次创建/跳转）。

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/App.tsx
git commit -m "renderer: subscribe to tray IPC for new-conversation / navigate-settings"
```

---

## Task 9: 收尾 — spec + plan 入仓 + 全量回归

**Files:**
- Track: `docs/superpowers/specs/2026-05-15-tray-context-menu-design.md`
- Track: `docs/superpowers/plans/2026-05-15-tray-context-menu-plan.md`

- [ ] **Step 1: 全量 build 验证**

Run: `npm run build`

Expected: typecheck PASS + electron-vite build PASS。如有 typecheck 错误，定位修复（最常见原因：preload 端类型缺失、未导出的辅助函数）。

- [ ] **Step 2: 完整回归手测**

Run: `npm run dev`

按 spec §8 的测试计划全跑一遍：

1. 启动 → 右键托盘 → 菜单显示 14 行 + 子菜单。
2. 切换语言（设置页）→ 菜单文案随之更新。
3. 点"打开设置" → 主窗显示并进入设置页。
4. 点"开始截图翻译" → 进入区域选择 → 选择后落入 Quick Assistant。
5. 切换"始终置顶主窗" → 主窗 always-on-top 状态变化；菜单 checkbox 同步。
6. 切换"关闭时隐藏到托盘" → 主窗 close 行为变化；菜单 checkbox 同步；从设置页切回相同行也同步。
7. "开机自启"显示 disabled + dev 模式后缀。
8. 点"检查更新" → 主窗显示 → 跳到关于页 → updater 状态变 `not-available`。
9. 点"打开数据目录" → 系统文件管理器打开 `./data`。
10. 点"关于" → 弹窗显示版本号。
11. 点"v<version>"项无反应。
12. 点"退出" → app 真正退出。

任何一项不通过，回到对应 Task 修复后再回归。

- [ ] **Step 3: 入仓 spec + plan**

```bash
git add docs/superpowers/specs/2026-05-15-tray-context-menu-design.md docs/superpowers/plans/2026-05-15-tray-context-menu-plan.md
git commit -m "docs: add tray context menu design and implementation plan"
```

- [ ] **Step 4: 推送（可选，等用户指示）**

```bash
git push
```

不主动推送；由用户决定时机。

---

## Risk Notes（实施时留意）

- **`refreshSelectionFilterConfig` 命名**：如 selection-service 实际导出名不同，Task 5 Step 2 已建议先 grep 确认；按实际名称修正 import 即可。
- **`createWindow` 闭包**：tray.ts 不 import `createWindow`，避免循环 import；它通过 `ensureMainWindow` 闭包从 index.ts 注入。
- **`isQuitting` 标记**：tray "退出"项依赖 `app.on('before-quit')` 来设置 `isQuitting = true`，否则 close handler 仍会走 hide。验证步骤已加。
- **Conventional commit 前缀**：本计划已按子系统打前缀（`refactor:` / `feat:` / `ipc:` / `i18n:` / `preload:` / `renderer:` / `docs:`），与 `git log` 风格一致。
- **subagent 实施时**：每个 Task 是独立可交付单元，前后依赖关系已在文件顶部说明。可以"实现一个 Task → typecheck → commit → 进入下一个"的流式推进。
