# Tray Context Menu — Design

- 日期：2026-05-15
- 作者：LastWhisper（brainstorming 协作）
- 状态：草案，待用户审阅

## 1. 背景

当前 `src/main/index.ts` 的 `updateTrayMenu()` 只暴露 4 项：打开主窗口 / ☑ 启用划词助手 / 关于 / 退出。功能定位偏简，未利用现有的全局快捷键、设置项、自动更新器与截图模块。

目标：把托盘右键菜单升级为"快速操作 + 系统开关"的综合面板，让用户在主窗口隐藏时也能调起核心能力、查看与切换关键设置。

非目标：

- 不在 tray 暴露危险操作（重置 / 清空数据 / 数据库管理）。
- 不引入新的 AI 功能、不改 AI 调用路径。
- 不改造主窗 UI、不改设置页结构（只复用现有 section 跳转能力）。
- 不在 macOS / Linux 上做平台特化（项目主目标 Windows；macOS/Linux 暂保持与 Windows 一致的菜单文本）。

## 2. 菜单结构

```
打开主窗口
新建会话                       Ctrl+N
开始截图翻译                   Alt+P
─────────────────────
☑ 启用划词助手                 Alt+H
☑ 始终置顶主窗
─────────────────────
☑ 开机自启 [(开发模式不可用)]
☑ 关闭时隐藏到托盘
☐ 启动时最小化到托盘
─────────────────────
打开设置                       Ctrl+,
设置与维护                    ▶
   ├ 检查更新
   ├ 打开数据目录
   └ 关于 AI Studio
─────────────────────
v1.5.0                        （非交互项）
退出
```

约定：

- 加速键提示用 `label: '新建会话\tCtrl+N'`，不通过 `accelerator` 字段注册（避免与已有 in-app/global shortcut 重复绑定）。
- 所有 checkbox 状态都直接读自权威源（settings DB 或 `BrowserWindow` 当前值），不缓存。

## 3. 点击行为

| 菜单项               | 主进程动作                                                                                                            |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 打开主窗口           | `showWindow(ensureMainWindow())`                                                                                      |
| 新建会话             | `showWindow(ensureMainWindow())` + push `IpcChannels.TRAY_NEW_CONVERSATION` 给主窗                                    |
| 开始截图翻译         | 调 `startScreenshot()`（已有），其内部自动隐藏主窗 → 区域选择 → 推到 Quick Assistant                                  |
| ☑ 启用划词助手       | `toggleSelectionAssistant()`（已有 `IpcChannels.SELECTION_TOGGLE` handler 内的逻辑，提取或直接调）                    |
| ☑ 始终置顶主窗       | `mainWindow.setAlwaysOnTop(!mainWindow.isAlwaysOnTop())`；`getMainWindow() == null` 时 `enabled: false`               |
| ☑ 开机自启           | `writeSettingFromMain('app.autoLaunch', next)`；dev 模式下 `enabled: false` 且 label 加后缀                           |
| ☑ 关闭时隐藏到托盘   | `writeSettingFromMain('app.closeToTray', next)`                                                                       |
| ☐ 启动时最小化到托盘 | `writeSettingFromMain('app.startMinimized', next)`                                                                    |
| 打开设置             | `showWindow(ensureMainWindow())` + push `TRAY_NAVIGATE_SETTINGS`（payload 空，renderer fall back 到 'general'）       |
| 检查更新             | `showWindow(ensureMainWindow())` + push `TRAY_NAVIGATE_SETTINGS({ section: 'about' })` + `void checkForUpdates(true)` |
| 打开数据目录         | `shell.openPath(getDataDir())`（getDataDir 在 `src/main/utils/paths.ts`，dev 为 `./data`，prod 为 userData/）         |
| 关于 AI Studio       | 保留现有 `dialog.showMessageBox`；detail 中追加 `app.getVersion()`                                                    |
| v1.5.0               | `{ label: 'v' + app.getVersion(), enabled: false }`                                                                   |
| 退出                 | `isQuitting = true; app.quit()`                                                                                       |

`next = !current`，`current` 来自 `getSetting(key)` 解析（同 `applyXxxSetting` 的判定规则）。

## 4. 状态同步

托盘 checkbox 必须实时反映系统状态，无论是 tray 自己触发还是其它路径触发。重建 `updateTrayMenu()` 的时机：

| 事件                                       | 接入点                                          | 备注                         |
| ------------------------------------------ | ----------------------------------------------- | ---------------------------- |
| 语言切换                                   | 已有：`onLanguageChange(updateTrayMenu)`        | 不变                         |
| 划词助手 toggle                            | 已有：`SELECTION_TOGGLE` handler 内             | 不变                         |
| 任意 `settings:set` / `settings:set-batch` | **新增**：经 `settings-bus` 通知 tray           | 见下方 §5                    |
| `mainWindow.always-on-top-changed`         | 已有事件，**新增**：回调内调 `updateTrayMenu()` | 在 `index.ts` 现有监听处追加 |
| `mainWindow` `'closed'`（destroy）         | **新增**：调 `updateTrayMenu()`                 | 让"始终置顶"项变 disabled    |

tray 不订阅 `closeToTray` 引起的 hide（窗口仅 hide 不 destroy，菜单状态不变）。

## 5. 架构改动

### 5.1 抽出 `src/main/tray.ts`

新模块导出：

```ts
export interface TrayDeps {
  /** 读 mainWindow 当前状态（决定 enabled / checked），允许返回 null */
  getMainWindow: () => BrowserWindow | null
  /** 触发动作时使用：若主窗不存在/已 destroy，由 index.ts 闭包负责调 createWindow() 并返回新实例 */
  ensureMainWindow: () => BrowserWindow
  /** show + focus（由 index.ts 提供，避免循环 import） */
  showWindow: (win: BrowserWindow) => void
}

export function createTray(deps: TrayDeps): void
export function updateTrayMenu(): void
export function destroyTray(): void
```

`createTray` 内部完成：实例化 `new Tray(...)`、注册 click → `deps.showWindow(deps.ensureMainWindow())`、首次 `updateTrayMenu`、订阅 settings-bus（见 §5.2）。

`updateTrayMenu` 是幂等的，可由任意触发源调用。

### 5.2 新增 `src/main/settings-bus.ts`

把 `settings-handlers.ts` 中现有的 module-private 工具暴露为 main 进程内可复用 API：

```ts
import { EventEmitter } from 'events'
import { BrowserWindow } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import { setSetting, setSettingsBatch } from './db'
import { applySideEffects } from './settings-side-effects' // §5.3

const emitter = new EventEmitter()

function broadcastToRenderers(entries: Record<string, string>, excludeSenderId?: number): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    if (excludeSenderId !== undefined && win.webContents.id === excludeSenderId) continue
    win.webContents.send(IpcChannels.SETTINGS_CHANGED, entries)
  }
}

/**
 * 低级：副作用 + 广播 + 同进程事件，但**不写库**。
 * 给 IPC handler 用：renderer 已经把值传上来，handler 自己 setSetting 后调本函数。
 * 通过 excludeSenderId 跳过发送方窗口（保留 settings-handlers 现有 senderId 行为）。
 */
export function applyAndBroadcast(entries: Record<string, string>, excludeSenderId?: number): void {
  for (const [k, v] of Object.entries(entries)) applySideEffects(k, v)
  broadcastToRenderers(entries, excludeSenderId)
  emitter.emit('changed', entries)
}

/** 高级：主进程内主动写设置：写库 + applyAndBroadcast。 */
export function writeSettingFromMain(key: string, value: string): void {
  setSetting(key, value)
  applyAndBroadcast({ [key]: value })
}

export function writeSettingsFromMain(entries: Record<string, string>): void {
  setSettingsBatch(entries)
  applyAndBroadcast(entries)
}

export function onSettingsChanged(handler: (entries: Record<string, string>) => void): () => void {
  emitter.on('changed', handler)
  return () => emitter.off('changed', handler)
}
```

### 5.3 抽出 `src/main/settings-side-effects.ts`

把 `settings-handlers.ts` 第 19–67 行的 `applyZoomSetting` / `applyLanguageSetting` / `settingSideEffects` 表 / `applySideEffects` 整体迁移到 `settings-side-effects.ts` 并 `export`，让 settings-bus 与 settings-handlers 都能 import。

`settings-handlers.ts` 改为：

1. 从 `settings-side-effects.ts` import `applySideEffects`（仅用于一些边角，多数下游已迁出）
2. 从 `settings-bus.ts` import `applyAndBroadcast`
3. `SETTINGS_SET` handler 改为：`setSetting(key, value); applyAndBroadcast({ [key]: value }, event.sender.id)`
4. `SETTINGS_SET_BATCH` handler 改为：`setSettingsBatch(entries); applyAndBroadcast(entries, event.sender.id)`
5. 删除 module-private 的 `applySideEffects` / `broadcastSettingsChanged`（已迁出）

### 5.4 tray.ts 订阅设置变化

```ts
const TRAY_RELEVANT_KEYS = new Set([
  'app.autoLaunch',
  'app.closeToTray',
  'app.startMinimized',
  'selection.enabled',
])

onSettingsChanged((entries) => {
  for (const key of Object.keys(entries)) {
    if (TRAY_RELEVANT_KEYS.has(key)) {
      updateTrayMenu()
      return
    }
  }
})
```

### 5.5 新 IPC channel

`src/shared/ipc-channels.ts`：

```ts
TRAY_NEW_CONVERSATION: 'tray:new-conversation',
TRAY_NAVIGATE_SETTINGS: 'tray:navigate-settings',
```

`src/preload/index.ts` 暴露：

```ts
onTrayNewConversation: (handler: () => void) => () => void
onTrayNavigateSettings: (handler: (payload: { section?: SettingsSection }) => void) => () => void
```

`src/renderer/src/App.tsx` 在 `useEffect` 中订阅：

```ts
useEffect(() => {
  const off1 = window.api.onTrayNewConversation(() => {
    void useConversationStore.getState().createConversation()
  })
  const off2 = window.api.onTrayNavigateSettings(({ section }) => {
    useSettingsStore.getState().navigateToSettings(section ?? 'general')
  })
  return () => {
    off1()
    off2()
  }
}, [])
```

`SettingsSection` 已在 `src/renderer/src/stores/settingsStore.ts` 定义；'about' 已是合法值（`AboutSection` 已存在）。

### 5.6 index.ts 改动

- 删除：`tray` 变量、`Tray` import、`updateTrayMenu` 内联实现、`tray = new Tray(...)`、`tray.on('click', ...)`、`tray.setToolTip(...)`、`tray?.destroy()`。
- 改为：
  ```ts
  import { createTray, updateTrayMenu, destroyTray } from './tray'
  // ...
  createTray({
    getMainWindow: () => mainWindow,
    ensureMainWindow: () => {
      if (!mainWindow || mainWindow.isDestroyed()) createWindow()
      return mainWindow!
    },
    showWindow,
  })
  onLanguageChange(() => updateTrayMenu())
  ```
- `'window-all-closed'` 内改为 `destroyTray()`。
- `mainWindow.on('always-on-top-changed', ...)` 回调内追加 `updateTrayMenu()`。
- `mainWindow.on('closed', ...)`（如已有；否则新增）调 `updateTrayMenu()`。
- `SELECTION_TOGGLE` handler 保留 `updateTrayMenu()` 调用。
- 不再在 settings 变化路径上手动调 `updateTrayMenu`——由 settings-bus 自动驱动。
- `createWindow` 保持 module-private；通过 `ensureMainWindow` 闭包暴露给 tray，避免循环 import。

## 6. i18n 文案

`src/renderer/src/i18n/locales/zh-CN.json` `tray` 段扩充：

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
}
```

`en.json` 对应：

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
}
```

加速键提示直接写在 label 中（如 `t('tray.newConversation') + '\\tCtrl+N'`），不放入 i18n 字符串，因为加速键的显示文本对中英两语相同。

## 7. 边界情况

- **dev 模式 + 开机自启**：`applyAutoLaunchSetting` 在 `is.dev` 下 no-op；菜单项 `enabled: false`，label 用 `autoLaunchDevDisabled`。点击不应发生但即便发生也无副作用。
- **dev / 未打包 + 检查更新**：`checkForUpdates(true)` 内部已 push `status: 'not-available'`；AboutSection 正常显示，不需 tray 做特判。
- **主窗已 destroy**：`always-on-top` 项 `enabled: false`；"新建会话"、"打开设置"、"检查更新"通过 `ensureMainWindow()` 自动重新创建（由 index.ts 闭包负责）。`getMainWindow()` 仅用于"读状态决定 enabled/checked"，"触发动作"统一走 `ensureMainWindow()`。
- **多次连续 toggle**：`writeSettingFromMain` 同步执行；`updateTrayMenu` 在事件回调中触发；不会出现 checkbox 状态错乱。
- **macOS / Linux**：`Tray` API 跨平台。`shell.openPath` 跨平台。`app.setLoginItemSettings` 在 macOS 也可用，Linux 通常 no-op；菜单文案不做平台特化。

## 8. 测试计划（手动）

dev 模式：

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
11. 点"v1.5.0"项无反应。
12. 点"退出" → app 真正退出。

打包后（可作为发布前快测）：

13. 开机自启项可点；点击后重启系统验证生效。
14. 检查更新流程在有更新时能下载、安装；无更新时回到 `not-available`。

## 9. 文件改动清单

新增：

- `src/main/tray.ts`
- `src/main/settings-bus.ts`
- `src/main/settings-side-effects.ts`

修改：

- `src/main/index.ts`（拆出 tray 逻辑，追加 mainWindow 事件回调中的 updateTrayMenu）
- `src/main/ipc/settings-handlers.ts`（迁移副作用表与广播函数到上述两个新文件，handler 改为薄壳）
- `src/shared/ipc-channels.ts`（新增 2 个 channel 常量）
- `src/preload/index.ts`（新增 2 个订阅 API）
- `src/renderer/src/App.tsx`（订阅两个 tray IPC）
- `src/renderer/src/i18n/locales/zh-CN.json`（扩充 tray 段）
- `src/renderer/src/i18n/locales/en.json`（同上）

不动：

- `src/main/screenshot.ts`、`src/main/auto-updater.ts`、`src/main/app-state.ts`、`src/main/selection-service.ts`、`src/main/quick-assistant-window.ts`。

## 10. 待裁决（如有）

无遗留分歧；所有决策点已在 brainstorming 对话中确认。

## 11. 后续

按本设计进入 `writing-plans`，产出可执行的实现计划（任务拆分、顺序、验证点）。
