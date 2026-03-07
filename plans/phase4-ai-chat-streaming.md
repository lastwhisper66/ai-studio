# 阶段四实现计划：AI 对话核心 — OpenAI 集成与流式响应

> 文件重命名：`adaptive-booping-sphinx.md` → `phase4-ai-chat-streaming.md`

## Context

阶段 1-3 已完成：Electron 骨架、Shadcn/UI 布局、SQLite 数据库与 IPC CRUD。当前应用可以创建/删除/重命名对话，但发送消息后无 AI 回复。本阶段将集成 OpenAI API，实现流式打字机效果，让应用成为一个真正可用的 AI 聊天工具。

核心挑战：OpenAI 流式响应需要通过 Electron IPC 桥接到渲染进程。现有 IPC 全部使用 request-response 模式（`ipcMain.handle` / `ipcRenderer.invoke`），本阶段需引入 push 模式（`webContents.send` / `ipcRenderer.on`）用于逐块推送。

---

## 实现步骤

### 第 1 步：安装 openai SDK

```bash
pnpm add openai
```

`openai` 包含 `OpenAI` 和 `AzureOpenAI` 两个类，纯 JS 无原生依赖，无需配置 `asarUnpack`。

---

### 第 2 步：添加 IPC 通道常量

**文件**: `src/shared/ipc-channels.ts`

在现有 `IpcChannels` 对象末尾新增 5 个通道：

```typescript
// Chat (streaming)
CHAT_SEND_MESSAGE: 'chat:send-message',       // invoke: 发起流式请求
CHAT_STREAM_CHUNK: 'chat:stream-chunk',        // push: 逐块文本
CHAT_STREAM_END: 'chat:stream-end',            // push: 流结束 + 完整消息
CHAT_STREAM_ERROR: 'chat:stream-error',        // push: 错误
CHAT_STOP_GENERATION: 'chat:stop-generation',  // invoke: 中断生成
```

---

### 第 3 步：添加流式通信类型

**文件**: `src/shared/types.ts`

在现有类型后新增：

```typescript
/** chat:send-message 的请求参数 */
export interface SendMessagePayload {
  conversationId: string
  content: string
}

/** chat:stream-chunk 推送数据 */
export interface StreamChunkData {
  conversationId: string
  delta: string
}

/** chat:stream-end 推送数据 */
export interface StreamEndData {
  conversationId: string
  message: Message | null  // null 表示用户中断
}

/** chat:stream-error 推送数据 */
export interface StreamErrorData {
  conversationId: string
  error: string
}
```

---

### 第 4 步：创建 AI 客户端模块

**新建目录**: `src/main/ai/`

#### `src/main/ai/openai-client.ts`
- 导出 `createOpenAIClient(settings: ApiSettings): OpenAI`
- 使用 `settings.apiKey` 和 `settings.baseUrl`

#### `src/main/ai/azure-client.ts`
- 导出 `createAzureClient(settings: ApiSettings): AzureOpenAI`
- 使用 `settings.apiKey`、`settings.endpoint`、`settings.apiVersion`（默认 `'2024-10-01-preview'`）、`settings.deploymentName`

#### `src/main/ai/index.ts`
- 导出 `createAIClient(settings: ApiSettings): OpenAI` — 工厂函数，根据 `provider` 选择客户端
  - `AzureOpenAI extends OpenAI`，返回类型兼容
- 导出 `loadApiSettings(): ApiSettings` — 从 DB settings 表读取配置
  - key 前缀 `api.`（如 `api.apiKey`、`api.model`）
  - 默认值：`model='gpt-4o'`、`temperature=0.7`、`maxTokens=4096`
  - apiKey 为空时抛出错误提示用户配置
- 导出 `generateTitle(client, model, userMsg, assistantMsg): Promise<string>` — AI 生成对话标题
  - 用非流式请求，system prompt 要求生成 ≤6 词标题
  - try-catch 失败时 fallback 为截断用户消息

**复用**: 使用现有 `src/main/db/settings.ts` 的 `getAllSettings()` 读取配置。

---

### 第 5 步：实现流式聊天 IPC Handler（核心）

**新建文件**: `src/main/ipc/chat-handlers.ts`

导出 `registerChatHandlers(): void`，注册两个 handler：

#### `CHAT_SEND_MESSAGE` handler（`ipcMain.handle`）

```
入参: (event: IpcMainInvokeEvent, payload: SendMessagePayload)
返回: Promise<IpcResult<void>>
```

流程：
1. `loadApiSettings()` 加载 API 配置
2. `listMessages(conversationId)` 加载对话历史（此时用户消息已由渲染进程保存）
3. 构建 API messages 数组（可选 system prompt + 历史消息）
4. `createAIClient(settings)` 创建客户端
5. 创建 `AbortController`，存入模块级 `Map<string, AbortController>`（key=conversationId）
6. `client.chat.completions.create({ stream: true, ... }, { signal })` 发起流式请求
7. `for await (chunk of stream)` 循环：
   - 提取 `chunk.choices[0]?.delta?.content`
   - 累加 `fullContent`
   - 通过 `event.sender.send(CHAT_STREAM_CHUNK, { conversationId, delta })` 推送
   - **安全守卫**: 每次 send 前检查 `!event.sender.isDestroyed()`
8. 流结束：`createMessage(conversationId, 'assistant', fullContent)` 保存到 DB
9. 推送 `CHAT_STREAM_END`（含已保存的 Message 对象）
10. 清理 `activeStreams` Map
11. 自动标题：若对话历史仅 1 条用户消息（首次对话），调用 `generateTitle()` 生成标题，更新 DB，推送 `CHAT_TITLE_UPDATED` 事件

**错误处理**:
- `AbortError`（用户中断）→ 保存已累积的部分内容到 DB → 推送 `CHAT_STREAM_END`（含部分消息）
- 其他错误 → 推送 `CHAT_STREAM_ERROR`

#### `CHAT_STOP_GENERATION` handler（`ipcMain.handle`）

```
入参: (_, conversationId: string)
返回: IpcResult<void>
```

从 `activeStreams` Map 中取 AbortController 并调用 `.abort()`。

---

### 第 6 步：注册 chat handlers

**文件**: `src/main/ipc/index.ts`

添加 `import { registerChatHandlers }` 并在 `registerAllIpcHandlers()` 中调用。

---

### 第 7 步：更新 Preload 暴露流式 API

**文件**: `src/preload/index.ts`

在 `api` 对象中新增 6 个方法：

```typescript
// invoke 方法（同现有模式）
sendMessage: (payload) => ipcRenderer.invoke(CHAT_SEND_MESSAGE, payload),
stopGeneration: (conversationId) => ipcRenderer.invoke(CHAT_STOP_GENERATION, conversationId),

// 事件监听方法（新模式 — 返回 cleanup 函数）
onStreamChunk: (callback: (data: StreamChunkData) => void) => {
  const handler = (_e, data) => callback(data)  // 剥离 IpcRendererEvent
  ipcRenderer.on(CHAT_STREAM_CHUNK, handler)
  return () => ipcRenderer.removeListener(CHAT_STREAM_CHUNK, handler)
},
onStreamEnd: (callback: (data: StreamEndData) => void) => { /* 同上模式 */ },
onStreamError: (callback: (data: StreamErrorData) => void) => { /* 同上模式 */ },

// 安全兜底：卸载所有流式监听器
removeAllStreamListeners: () => {
  ipcRenderer.removeAllListeners(CHAT_STREAM_CHUNK)
  ipcRenderer.removeAllListeners(CHAT_STREAM_END)
  ipcRenderer.removeAllListeners(CHAT_STREAM_ERROR)
},
```

**注意**: `index.d.ts` 无需手动修改——它使用 `typeof api` 自动推导类型。

需要在 import 中新增 `SendMessagePayload`、`StreamChunkData`、`StreamEndData`、`StreamErrorData` 类型。

---

### 第 8 步：扩展 conversationStore

**文件**: `src/renderer/src/stores/conversationStore.ts`

**不创建独立 chatStore**——扩展现有 store，因为：
- 现有 store 已持有 `messages`、`activeConversationId`、`addMessage()`
- 流式状态（`isStreaming`、`streamingContent`）与活跃对话强绑定
- 避免两个 store 之间的交叉引用

新增状态字段：

```typescript
isStreaming: boolean        // 默认 false
streamingContent: string   // 默认 ''
```

新增 actions：

#### `sendMessage(content: string): Promise<void>`

完整流程：
1. 如果无活跃对话，先 `createConversation()`
2. 调用 `addMessage('user', content)` 保存用户消息（复用现有逻辑）
3. `set({ isStreaming: true, streamingContent: '' })`
4. **先注册** 3 个事件监听器（避免竞态：main 进程可能在 invoke 返回前就推送了 chunk）
   - `onStreamChunk`: 过滤 conversationId → 累加 `streamingContent`
   - `onStreamEnd`: 添加最终 Message 到 `messages` 数组 → 清除流式状态 → 自动标题检查 → cleanup
   - `onStreamError`: 设置 `error` → 清除流式状态 → cleanup
5. 调用 `window.api.sendMessage({ conversationId, content })`
6. 若 invoke 返回失败，清除状态 + cleanup

#### `stopGeneration(): void`

调用 `window.api.stopGeneration(activeConversationId)`。

#### 修改现有 `addMessage`

移除其中的自动标题逻辑（truncation）——标题生成将由 `sendMessage` 流程中的 `onStreamEnd` 处理（AI 生成标题 + fallback 截断）。

---

### 第 9 步：拆分 ChatPanel 为模块化组件

**新建目录**: `src/renderer/src/components/chat/`

#### `MessageBubble.tsx`

```typescript
interface Props {
  role: MessageRole
  content: string
  isStreaming?: boolean  // 流式消息末尾显示闪烁光标
}
```

- 用户消息：右对齐，`bg-primary text-primary-foreground`
- AI 消息：左对齐，`bg-muted`
- `whitespace-pre-wrap` 保留换行
- isStreaming=true 时末尾加 `animate-pulse` 的光标 span

#### `MessageList.tsx`

```typescript
interface Props {
  messages: Message[]
  streamingContent: string
  isStreaming: boolean
}
```

- `ScrollArea` 容器
- map messages → `MessageBubble`
- 当 `isStreaming && streamingContent` 时，追加一个流式 `MessageBubble`（role=assistant, isStreaming=true）
- `useRef` + `useEffect` 实现自动滚动（messages 或 streamingContent 变化时）
- 无对话/无消息时的空状态提示

#### `MessageInput.tsx`

```typescript
interface Props {
  onSend: (content: string) => void
  onStop: () => void
  isStreaming: boolean
}
```

- `Textarea` + Enter 发送 / Shift+Enter 换行（保持现有行为）
- 非流式时：Send 按钮（Send icon）
- 流式时：Stop 按钮（Square icon，destructive 样式）+ 禁用 Textarea
- 发送后清空输入

#### `ChatView.tsx`

主容器组件，连接 store，组合以上子组件：

```typescript
export function ChatView(): React.JSX.Element
```

- 从 `useConversationStore` 读取所有需要的状态和 actions
- 渲染：标题栏 + `MessageList` + 错误横幅 + `MessageInput`
- 处理自动创建对话逻辑（无活跃对话时首次发送）

#### `index.ts`

barrel export。

---

### 第 10 步：简化 ChatPanel

**文件**: `src/renderer/src/components/layout/ChatPanel.tsx`

替换为薄包装器：

```typescript
import { ChatView } from '@renderer/components/chat/ChatView'

export function ChatPanel(): React.JSX.Element {
  return <ChatView />
}
```

保留 ChatPanel.tsx 以避免修改 AppLayout.tsx 的 import。

---

## 文件变更总览

| 顺序 | 文件 | 操作 | 说明 |
|------|------|------|------|
| 1 | `package.json` | 修改 | 添加 `openai` 依赖 |
| 2 | `src/shared/ipc-channels.ts` | 修改 | +5 个 chat 通道 |
| 3 | `src/shared/types.ts` | 修改 | +4 个流式通信类型 |
| 4 | `src/main/ai/openai-client.ts` | 新建 | OpenAI 客户端 |
| 5 | `src/main/ai/azure-client.ts` | 新建 | Azure 客户端 |
| 6 | `src/main/ai/index.ts` | 新建 | 工厂 + 配置加载 + 标题生成 |
| 7 | `src/main/ipc/chat-handlers.ts` | 新建 | 流式核心 handler |
| 8 | `src/main/ipc/index.ts` | 修改 | 注册 chat handlers |
| 9 | `src/preload/index.ts` | 修改 | +6 个流式 API 方法 |
| 10 | `src/renderer/src/stores/conversationStore.ts` | 修改 | +isStreaming/streamingContent/sendMessage/stopGeneration |
| 11 | `src/renderer/src/components/chat/MessageBubble.tsx` | 新建 | 消息气泡 |
| 12 | `src/renderer/src/components/chat/MessageList.tsx` | 新建 | 消息列表 + 自动滚动 |
| 13 | `src/renderer/src/components/chat/MessageInput.tsx` | 新建 | 输入框 + 发送/停止 |
| 14 | `src/renderer/src/components/chat/ChatView.tsx` | 新建 | 聊天主视图 |
| 15 | `src/renderer/src/components/chat/index.ts` | 新建 | barrel export |
| 16 | `src/renderer/src/components/layout/ChatPanel.tsx` | 修改 | 简化为 ChatView 包装器 |

---

## 验证计划

1. **编译检查**: `pnpm typecheck` 和 `pnpm lint` 无错误
2. **启动测试**: `pnpm dev` 正常启动，布局无变化
3. **无 API Key 测试**: 发送消息 → 错误横幅显示 "API key is not configured"
4. **配置 API Key**（临时通过 sqlite CLI 或代码写入 settings 表）→ 发送消息 → AI 逐字流式回复
5. **停止按钮**: 流式过程中点击停止 → 生成中断，部分内容保存
6. **持久化**: 重启应用 → 消息历史保留
7. **对话切换**: 切换到其他对话 → 加载正确的历史消息
8. **自动标题**: 首条消息后 → 侧边栏对话标题自动更新为 AI 生成的标题
