# 阶段三：IPC 通信 + SQLite 数据库 + 对话管理 — 分步执行计划

## Context

当前项目已完成阶段一（脚手架）和阶段二（UI 基础），拥有静态的左右分栏布局但没有任何数据交互能力。本阶段将建立从数据库到 UI 的完整数据通路，使应用从"静态原型"变为"可交互应用"——用户能创建、切换、重命名、删除对话，消息能持久化存储。

## 执行路线图

```
Step 1: 安装依赖 + pnpm 配置
  ↓
Step 2: 构建 & TS 配置变更 (5 文件)
  ↓
Step 3: 共享类型 src/shared/ (3 新文件)
  ↓
  ├─→ Step 4: 数据库模块 src/main/db/ (5 新文件)
  │     ↓
  └─→ Step 5: IPC Handlers src/main/ipc/ (4 新文件)
        ↓
Step 6: 主进程入口 + Preload 桥接 (3 文件修改)
  ↓
Step 7: Zustand conversationStore (1 新文件)
  ↓
Step 8: 更新 UI (App + Sidebar + ChatPanel)
  ↓
Step 9: typecheck 验证 + 修复
```

---

## Step 1: 安装依赖 + 配置 pnpm

**状态**：✅ 已完成
**依赖**：无
**变更**：`package.json`

### 操作

```bash
pnpm add better-sqlite3 uuid zustand
pnpm add -D @types/better-sqlite3 @types/uuid
```

修改 `package.json` 的 `pnpm.onlyBuiltDependencies` 加入 `better-sqlite3`：

```jsonc
"pnpm": {
  "onlyBuiltDependencies": ["electron", "esbuild", "better-sqlite3"]
}
```

### 验证

- `pnpm install` 无报错
- `node_modules/better-sqlite3` 存在

---

## Step 2: 构建 & TypeScript 配置变更 (5 文件)

**状态**：✅ 已完成
**依赖**：Step 1

### 2.1 `electron-builder.yml`

- `npmRebuild: false` → `npmRebuild: true`（better-sqlite3 native 模块需要编译）
- `asarUnpack` 添加 `node_modules/better-sqlite3/**`（native .node 文件无法从 asar 加载）

```yaml
asarUnpack:
  - resources/**
  - node_modules/better-sqlite3/**
npmRebuild: true
```

### 2.2 `electron.vite.config.ts`

main、preload、renderer 三个配置均添加 `@shared` 路径别名：

```ts
import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    resolve: {
      alias: { '@shared': resolve('src/shared') },
    },
  },
  preload: {
    resolve: {
      alias: { '@shared': resolve('src/shared') },
    },
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared'),
      },
    },
    plugins: [tailwindcss(), react()],
  },
})
```

### 2.3 `tsconfig.json`

`paths` 添加 `"@shared/*": ["src/shared/*"]`：

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@renderer/*": ["src/renderer/src/*"],
      "@shared/*": ["src/shared/*"]
    }
  }
}
```

### 2.4 `tsconfig.node.json`

`include` 添加 `"src/shared/**/*"`：

```json
{
  "include": ["electron.vite.config.*", "src/main/**/*", "src/preload/**/*", "src/shared/**/*"]
}
```

### 2.5 `tsconfig.web.json`

`include` 添加 `"src/shared/**/*"`，`paths` 添加 `"@shared/*": ["src/shared/*"]`：

```json
{
  "include": [
    "src/renderer/src/env.d.ts",
    "src/renderer/src/**/*",
    "src/renderer/src/**/*.tsx",
    "src/preload/*.d.ts",
    "src/shared/**/*"
  ],
  "compilerOptions": {
    "paths": {
      "@renderer/*": ["src/renderer/src/*"],
      "@shared/*": ["src/shared/*"]
    }
  }
}
```

### 验证

- `pnpm typecheck` 仍然通过（此时 shared 目录尚为空，不影响）

---

## Step 3: 创建共享类型 `src/shared/` (3 新文件)

**状态**：✅ 已完成
**依赖**：Step 2
**新建**：`src/shared/types.ts`, `src/shared/ipc-channels.ts`, `src/shared/index.ts`

### 3.1 `src/shared/types.ts` — 数据模型接口

```ts
export interface Conversation {
  id: string
  title: string
  createdAt: string // ISO 8601
  updatedAt: string
  model: string | null
  systemPrompt: string | null
}

export type MessageRole = 'user' | 'assistant' | 'system'

export interface Message {
  id: string
  conversationId: string
  role: MessageRole
  content: string
  createdAt: string
  tokenCount: number | null
}

export type ApiProvider = 'openai' | 'azure'

export interface ApiSettings {
  provider: ApiProvider
  apiKey: string
  baseUrl?: string
  endpoint?: string
  apiVersion?: string
  deploymentName?: string
  model: string
  temperature: number
  maxTokens: number
  systemPrompt: string
}

export interface IpcResult<T> {
  success: boolean
  data?: T
  error?: string
}
```

### 3.2 `src/shared/ipc-channels.ts` — IPC 通道常量

通道名遵循 `domain:action` 约定：

```ts
export const IpcChannels = {
  // Conversation
  CONVERSATION_LIST: 'conversation:list',
  CONVERSATION_GET: 'conversation:get',
  CONVERSATION_CREATE: 'conversation:create',
  CONVERSATION_UPDATE: 'conversation:update',
  CONVERSATION_DELETE: 'conversation:delete',
  // Message
  MESSAGE_LIST: 'message:list',
  MESSAGE_CREATE: 'message:create',
  MESSAGE_DELETE: 'message:delete',
  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_GET_ALL: 'settings:get-all',
} as const
```

### 3.3 `src/shared/index.ts` — 桶导出

```ts
export * from './types'
export * from './ipc-channels'
```

### 验证

- `pnpm typecheck` 通过

---

## Step 4: 数据库模块 `src/main/db/` (5 新文件)

**状态**：✅ 已完成
**依赖**：Step 3
**新建**：`src/main/db/database.ts`, `src/main/db/conversations.ts`, `src/main/db/messages.ts`, `src/main/db/settings.ts`, `src/main/db/index.ts`

### 关键设计

- DB 行使用 snake_case（`created_at`），TS 接口使用 camelCase（`createdAt`），通过 `rowToXxx()` 映射函数转换
- `uuid` v4 生成所有主键
- 表结构遵循 PLAN.md 中的 Schema 定义

### 4.1 `database.ts`

- 初始化 SQLite，数据库文件路径：`app.getPath('userData')/ai-studio.db`
- 启用 WAL 模式 + 外键约束
- 建表（conversations, messages, settings + 索引）
- 导出 `initDatabase()`, `closeDatabase()`, `getDb()`

### 4.2 `conversations.ts`

- `listConversations()` — 按 updated_at DESC 排序
- `getConversation(id)` — 单条查询
- `createConversation(title?)` — 插入 + 返回新记录
- `updateConversation(id, data)` — 更新 title/model/systemPrompt
- `deleteConversation(id)` — 删除（ON DELETE CASCADE 自动删消息）
- `touchConversation(id)` — 仅更新 updated_at 时间戳

### 4.3 `messages.ts`

- `listMessages(conversationId)` — 按 created_at ASC 排序
- `createMessage(conversationId, role, content)` — 插入 + 自动 touch 对话
- `deleteMessage(id)` — 单条删除

### 4.4 `settings.ts`

- `getSetting(key)` — 读取单个键
- `setSetting(key, value)` — 插入/更新（UPSERT）
- `getAllSettings()` — 返回全部键值对对象

### 4.5 `index.ts` — 桶导出

```ts
export { initDatabase, closeDatabase } from './database'
export * from './conversations'
export * from './messages'
export * from './settings'
```

### 验证

- `pnpm typecheck` 通过
- 代码逻辑 review（此时尚未注册 IPC，不可手动测试）

---

## Step 5: IPC Handlers `src/main/ipc/` (4 新文件)

**状态**：✅ 已完成
**依赖**：Step 4
**新建**：`src/main/ipc/conversation-handlers.ts`, `src/main/ipc/message-handlers.ts`, `src/main/ipc/settings-handlers.ts`, `src/main/ipc/index.ts`

### 关键设计

- 所有 handler 返回 `IpcResult<T>` 包装
- 错误在 try/catch 中捕获，返回 `{ success: false, error: message }`
- 使用 `ipcMain.handle()` 注册（支持 invoke/handle 双向通信模式）

### 5.1 `conversation-handlers.ts`

5 个 handler：list / get / create / update / delete

### 5.2 `message-handlers.ts`

3 个 handler：list / create / delete

### 5.3 `settings-handlers.ts`

3 个 handler：get / set / get-all

### 5.4 `index.ts`

```ts
export function registerAllIpcHandlers(): void {
  registerConversationHandlers()
  registerMessageHandlers()
  registerSettingsHandlers()
}
```

### 验证

- `pnpm typecheck` 通过

---

## Step 6: 主进程入口 + Preload 桥接 (3 文件修改)

**状态**：✅ 已完成
**依赖**：Step 4 + Step 5
**修改**：`src/main/index.ts`, `src/preload/index.ts`, `src/preload/index.d.ts`

### 6.1 `src/main/index.ts`

在 `app.whenReady()` 中，`createWindow()` 之前调用：

```ts
initDatabase()
registerAllIpcHandlers()
```

在 `window-all-closed` 中调用 `closeDatabase()`。

### 6.2 `src/preload/index.ts`

将空 `api` 对象替换为完整的 IPC API 包装，共 11 个方法：

**对话 (5 个)**：

- `listConversations()`
- `getConversation(id)`
- `createConversation(title?)`
- `updateConversation(id, data)`
- `deleteConversation(id)`

**消息 (3 个)**：

- `listMessages(conversationId)`
- `createMessage(conversationId, role, content)`
- `deleteMessage(id)`

**设置 (3 个)**：

- `getSetting(key)`
- `setSetting(key, value)`
- `getAllSettings()`

每个方法都是 `ipcRenderer.invoke(channel, ...args)` 的类型安全封装。
导出 `type ApiType = typeof api` 供类型声明使用。

### 6.3 `src/preload/index.d.ts`

```ts
import type { ElectronAPI } from '@electron-toolkit/preload'
import type { ApiType } from './index'

declare global {
  interface Window {
    electron: ElectronAPI
    api: ApiType
  }
}
```

### 验证

- `pnpm typecheck` 通过
- `pnpm dev` — 应用启动无报错
- DevTools 控制台无 IPC 错误
- `%APPDATA%/ai-studio/ai-studio.db` 文件已创建

---

## Step 7: Zustand conversationStore (1 新文件)

**状态**：✅ 已完成
**依赖**：Step 6
**新建**：`src/renderer/src/stores/conversationStore.ts`

### State

```ts
interface ConversationState {
  conversations: Conversation[]
  activeConversationId: string | null
  messages: Message[]
  isLoading: boolean
}
```

### Actions

| Action                          | 行为                                                                      |
| ------------------------------- | ------------------------------------------------------------------------- |
| `loadConversations()`           | 启动时从 DB 加载全部对话列表                                              |
| `createConversation(title?)`    | 创建新对话，自动设为 active，加载空消息                                   |
| `deleteConversation(id)`        | 删除对话；若删除当前对话则 fallback 到第一条或清空                        |
| `renameConversation(id, title)` | 更新对话标题                                                              |
| `setActiveConversation(id)`     | 切换对话，加载该对话的消息                                                |
| `addMessage(role, content)`     | 保存消息到 DB，追加到 messages 数组；首条用户消息自动截取内容作为对话标题 |

### 验证

- `pnpm typecheck` 通过

---

## Step 8: 更新 UI 组件 (App + Sidebar + ChatPanel)

**状态**：✅ 已完成
**依赖**：Step 7
**修改**：`src/renderer/src/App.tsx`, `src/renderer/src/components/layout/Sidebar.tsx`, `src/renderer/src/components/layout/ChatPanel.tsx`

### 8.1 `App.tsx`

- 添加 `useEffect` 在组件挂载时调用 `loadConversations()`

### 8.2 `Sidebar.tsx`

- 接入 `useConversationStore`
- "New Chat" 按钮 → `createConversation()`
- 渲染真实对话列表，高亮 `activeConversationId`
- 每个列表项右侧添加 `DropdownMenu`（MoreHorizontal 图标），含 "Rename" 和 "Delete"
- Rename 使用 `Dialog` + `Input` 弹窗
- 已有 Shadcn 组件：`dropdown-menu`、`dialog`、`button`、`input` 均已安装

### 8.3 `ChatPanel.tsx`

- 标题栏显示当前对话标题（无对话时显示 "New Chat"）
- 消息区域渲染 `messages` 数组：
  - user 消息：右对齐，主题色背景
  - assistant 消息：左对齐，次级背景
- Textarea + Send 按钮绑定发送逻辑：
  - Enter → 发送
  - Shift+Enter → 换行
  - 空消息不可发送
- 无活跃对话时显示 Welcome 屏幕

### 验证

- `pnpm typecheck` 通过
- `pnpm dev` 正常启动
- 点击 "New Chat" → 侧边栏出现新对话
- 输入消息 → 消息显示在聊天区域
- 切换对话 → 加载对应历史消息
- 右键重命名/删除 → 正常工作
- 重启应用 → 数据持久化

---

## Step 9: typecheck 验证 + 修复

**状态**：✅ 已完成
**依赖**：Step 8

### 操作

```bash
pnpm typecheck
pnpm lint
```

修复所有发现的类型错误和 lint 警告。

### 最终验证清单

1. `pnpm typecheck` — 全部通过，无类型错误
2. `pnpm dev` — 应用正常启动
3. 检查 `%APPDATA%/ai-studio/ai-studio.db` 文件存在
4. 点击 "New Chat" → 侧边栏出现新对话
5. 输入消息 → 消息显示在聊天区域
6. 切换对话 → 加载对应历史消息
7. 重启应用 → 对话列表和消息持久化保留
8. 右键/菜单重命名对话 → 标题更新
9. 删除对话 → 从列表移除，关联消息一并删除

---

## 文件清单汇总

**新建 13 个文件：**

| 文件                                           | 用途                    | Step |
| ---------------------------------------------- | ----------------------- | ---- |
| `src/shared/types.ts`                          | 数据模型接口            | 3    |
| `src/shared/ipc-channels.ts`                   | IPC 通道常量            | 3    |
| `src/shared/index.ts`                          | 桶导出                  | 3    |
| `src/main/db/database.ts`                      | SQLite 初始化与连接管理 | 4    |
| `src/main/db/conversations.ts`                 | 对话 CRUD               | 4    |
| `src/main/db/messages.ts`                      | 消息 CRUD               | 4    |
| `src/main/db/settings.ts`                      | 设置键值存储            | 4    |
| `src/main/db/index.ts`                         | DB 桶导出               | 4    |
| `src/main/ipc/conversation-handlers.ts`        | 对话 IPC handlers       | 5    |
| `src/main/ipc/message-handlers.ts`             | 消息 IPC handlers       | 5    |
| `src/main/ipc/settings-handlers.ts`            | 设置 IPC handlers       | 5    |
| `src/main/ipc/index.ts`                        | IPC 注册入口            | 5    |
| `src/renderer/src/stores/conversationStore.ts` | Zustand 状态管理        | 7    |

**修改 9 个文件：**

| 文件                                               | 变更                                  | Step |
| -------------------------------------------------- | ------------------------------------- | ---- |
| `package.json`                                     | 添加依赖 + pnpm.onlyBuiltDependencies | 1    |
| `electron-builder.yml`                             | npmRebuild + asarUnpack               | 2    |
| `electron.vite.config.ts`                          | @shared 别名                          | 2    |
| `tsconfig.json`                                    | @shared path                          | 2    |
| `tsconfig.node.json`                               | include shared                        | 2    |
| `tsconfig.web.json`                                | include shared + @shared path         | 2    |
| `src/main/index.ts`                                | 初始化 DB + 注册 IPC                  | 6    |
| `src/preload/index.ts`                             | 完整 API 桥接                         | 6    |
| `src/preload/index.d.ts`                           | 类型声明                              | 6    |
| `src/renderer/src/App.tsx`                         | 加载对话列表                          | 8    |
| `src/renderer/src/components/layout/Sidebar.tsx`   | 对话列表交互                          | 8    |
| `src/renderer/src/components/layout/ChatPanel.tsx` | 消息显示与发送                        | 8    |
