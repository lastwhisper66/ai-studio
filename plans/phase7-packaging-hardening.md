# 阶段七：打包发布 + 最终优化 — 实施计划

## Context

AI Studio 已完成阶段 1-6 的开发（Electron 骨架、UI、数据层、AI 流式聊天、设置、Markdown 渲染），现在需要进行安全加固、生产优化和打包发布。当前存在以下关键问题：

- **安全**: `sandbox: false`，未显式设置 `contextIsolation`/`nodeIntegration`，CSP 不完整
- **生产体验缺失**: 无单实例锁、无窗口状态记忆、未禁用生产 DevTools
- **性能**: 消息无分页（全量加载）、设置对话框未懒加载
- **打包配置**: electron-builder.yml 缺少部分生产配置

---

## 实施步骤

### 步骤 1：安全加固

**文件**: `src/main/index.ts` (第 15-18 行 webPreferences)

将 `webPreferences` 改为：

```typescript
webPreferences: {
  preload: join(__dirname, '../preload/index.js'),
  sandbox: true,
  contextIsolation: true,
  nodeIntegration: false,
}
```

> 安全说明：`better-sqlite3` 仅在 `src/main/db/` 中使用（main 进程），preload 脚本只用 `ipcRenderer` 和 `contextBridge`（sandbox 兼容），因此 `sandbox: true` 不会破坏功能。

**文件**: `src/renderer/index.html` (第 9 行 CSP)

补充 `frame-ancestors`、`base-uri`、`form-action`、`object-src` 指令：

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'
```

> `connect-src` 无需添加 — 所有 API 调用在 main 进程（Node.js http），不经过 renderer 的 fetch。

---

### 步骤 2：单实例锁

**文件**: `src/main/index.ts`

在 `app.whenReady()` 之前添加 `requestSingleInstanceLock()`，包裹现有的 `app.whenReady()` 块：

```typescript
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
    // ... 现有代码不变
  })
}
```

---

### 步骤 3：生产环境禁用 DevTools

**文件**: `src/main/index.ts`

在 `createWindow()` 内 `ready-to-show` 回调之后，添加：

```typescript
if (!is.dev) {
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      event.preventDefault()
    }
  })
}
```

> 使用 `before-input-event` 而非 `globalShortcut`，只影响应用窗口，不拦截系统全局快捷键。`is.dev` 来自已导入的 `@electron-toolkit/utils`。

---

### 步骤 4：窗口状态持久化

**文件**: `src/main/index.ts`

使用简单 JSON 文件存储窗口位置/大小（与数据库同目录 `data/`），无需额外依赖。

需要添加：

1. 导入 `readFileSync`、`writeFileSync` from `fs`，`dirname` from `path`
2. `WindowState` 接口 + `getWindowStatePath()` + `loadWindowState()` + `saveWindowState()` 辅助函数
3. 修改 `createWindow()` 使用持久化状态初始化窗口
4. 在 `mainWindow.on('close')` 时保存状态
5. 支持 `isMaximized` 状态（最大化时用 `getNormalBounds()` 获取正常尺寸）

数据路径逻辑复用 `src/main/db/database.ts` 中已有的模式：

```typescript
const appDir = app.isPackaged ? dirname(app.getPath('exe')) : app.getAppPath()
const statePath = join(appDir, 'data', 'window-state.json')
```

---

### 步骤 5：React 懒加载 SettingsDialog

**文件**: `src/renderer/src/components/layout/Sidebar.tsx`

将第 34 行的静态导入：

```typescript
import { SettingsDialog } from '@renderer/components/settings'
```

替换为：

```typescript
import { lazy, Suspense } from 'react'
const SettingsDialog = lazy(() =>
  import('@renderer/components/settings').then((m) => ({ default: m.SettingsDialog })),
)
```

在第 238 行的使用处包裹 `Suspense`：

```tsx
<Suspense fallback={null}>
  <SettingsDialog open={dialogOpen} onOpenChange={setDialogOpen} />
</Suspense>
```

> `fallback={null}` 合适 — 对话框初始为关闭状态，加载时无需显示占位。设置代码仅在用户首次点击设置时才会加载。

---

### 步骤 6：消息分页加载

这是最大的改动，跨越 5 个文件、4 个层次（数据库 → IPC 通道 → Handler → Preload → Store → UI）。

#### 6a. 数据库层

**文件**: `src/main/db/messages.ts`

新增 `listMessagesPaginated()` 函数（保留原 `listMessages()` 不变 — chat handler 需要完整历史构建 AI 上下文）：

```typescript
export function listMessagesPaginated(
  conversationId: string,
  limit: number = 50,
  beforeCreatedAt?: string,
): { messages: Message[]; hasMore: boolean } {
  const db = getDb()
  let rows: MessageRow[]

  if (beforeCreatedAt) {
    rows = db
      .prepare(
        'SELECT * FROM messages WHERE conversation_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?',
      )
      .all(conversationId, beforeCreatedAt, limit + 1) as MessageRow[]
  } else {
    rows = db
      .prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(conversationId, limit + 1) as MessageRow[]
  }

  const hasMore = rows.length > limit
  if (hasMore) rows.pop()

  return {
    messages: rows.reverse().map(rowToMessage),
    hasMore,
  }
}
```

> 技巧：查询 `limit + 1` 行来判断是否还有更多，多出的那行弹出不返回。`DESC` 排序取最新 N 条，最后 `reverse()` 恢复时间正序。

#### 6b. IPC 通道

**文件**: `src/shared/ipc-channels.ts`

在 Message 区块添加：

```typescript
MESSAGE_LIST_PAGINATED: 'message:list-paginated',
```

#### 6c. IPC Handler

**文件**: `src/main/ipc/message-handlers.ts`

导入 `listMessagesPaginated` 并注册 handler：

```typescript
ipcMain.handle(
  IpcChannels.MESSAGE_LIST_PAGINATED,
  (_, conversationId: string, limit?: number, beforeCreatedAt?: string) => {
    try {
      const data = listMessagesPaginated(conversationId, limit, beforeCreatedAt)
      return { success: true, data }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  },
)
```

#### 6d. Preload 暴露

**文件**: `src/preload/index.ts`

在 Messages 区块添加：

```typescript
listMessagesPaginated: (
  conversationId: string,
  limit?: number,
  beforeCreatedAt?: string,
): Promise<IpcResult<{ messages: Message[]; hasMore: boolean }>> =>
  ipcRenderer.invoke(IpcChannels.MESSAGE_LIST_PAGINATED, conversationId, limit, beforeCreatedAt),
```

> 类型会自动通过 `ApiType = typeof api` 传播到 `window.api`，无需手动更新 `index.d.ts`。

#### 6e. Store 改造

**文件**: `src/renderer/src/stores/conversationStore.ts`

1. 接口新增：`hasMoreMessages: boolean` + `loadMoreMessages: () => Promise<void>`
2. 初始状态：`hasMoreMessages: false`
3. `setActiveConversation` 改为调用 `listMessagesPaginated`
4. 新增 `loadMoreMessages` action
5. `deleteConversation` 中切换到下一个对话时也改用 `listMessagesPaginated`

#### 6f. UI 加载更多

**文件**: `src/renderer/src/components/chat/MessageList.tsx`

在消息列表顶部（`messages.map` 之前）添加"加载更多"按钮：

```tsx
{
  hasMoreMessages && (
    <div className="flex justify-center py-2">
      <Button variant="ghost" size="sm" onClick={loadMoreMessages}>
        Load earlier messages
      </Button>
    </div>
  )
}
```

从 store 获取 `hasMoreMessages` 和 `loadMoreMessages`。

---

### 步骤 7：electron-builder.yml 完善

**文件**: `electron-builder.yml`

添加：

```yaml
win:
  executableName: ai-studio
  icon: build/icon.ico # 显式指定图标路径
nsis:
  # ... 保留现有配置 ...
  oneClick: false # 引导式安装器
  allowToChangeInstallationDirectory: true
publish: null # 防止意外自动更新
```

---

### 步骤 8：构建验证

1. `npm run typecheck` — TypeScript 通过
2. `npm run lint` — ESLint 通过
3. `npm run dev` — 验证：
   - 应用正常启动
   - 启动第二个实例 → 聚焦已有窗口
   - 设置对话框可打开（懒加载生效）
   - 聊天流式回复正常
   - 长对话显示"Load earlier messages"按钮
   - 调整窗口大小/位置 → 关闭 → 重启 → 位置/大小保持
   - F12 / Ctrl+Shift+I 在 dev 模式可用
4. `npm run build:win` — 生成 .exe 安装包
5. 安装运行 → 验证 DevTools 被禁用、数据持久化、全功能正常

---

## 刻意排除的内容

| 排除项                      | 原因                                                                       |
| --------------------------- | -------------------------------------------------------------------------- |
| 虚拟滚动 (react-window)     | 分页加载后 DOM 中最多 50 条消息，`React.memo` 已防止重渲染，复杂度收益比低 |
| Shiki 预编译                | 当前懒单例模式已足够高效（初始化一次后缓存），预编译需构建步骤维护成本高   |
| IPC 输入验证                | `contextIsolation + sandbox` 已阻止外部访问，属于纵深防御范畴，可后续添加  |
| 自动更新 (electron-updater) | 需要更新服务器/GitHub Releases 配置，超出当前阶段范围                      |
| 代码签名                    | 需要购买证书，属于发布流程而非代码变更                                     |

---

## 变更文件清单

| 文件                                               | 变更                                                 |
| -------------------------------------------------- | ---------------------------------------------------- |
| `src/main/index.ts`                                | 安全加固 + 单实例锁 + DevTools 控制 + 窗口状态持久化 |
| `src/renderer/index.html`                          | CSP 增强                                             |
| `src/main/db/messages.ts`                          | 新增 `listMessagesPaginated`                         |
| `src/shared/ipc-channels.ts`                       | 新增 `MESSAGE_LIST_PAGINATED`                        |
| `src/main/ipc/message-handlers.ts`                 | 新增分页 handler                                     |
| `src/preload/index.ts`                             | 暴露 `listMessagesPaginated`                         |
| `src/renderer/src/stores/conversationStore.ts`     | 分页加载 + `loadMoreMessages`                        |
| `src/renderer/src/components/chat/MessageList.tsx` | "Load earlier messages" 按钮                         |
| `src/renderer/src/components/layout/Sidebar.tsx`   | 懒加载 SettingsDialog                                |
| `electron-builder.yml`                             | 完善打包配置                                         |
