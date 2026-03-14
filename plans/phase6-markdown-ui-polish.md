# Phase 6: Markdown 渲染 + 代码高亮 + UI 打磨

## Context

AI Studio 已完成 Phase 1-5，聊天功能完整但 AI 回复仅以纯文本渲染（`whitespace-pre-wrap`）。Phase 6 将实现 Markdown 渲染、代码语法高亮、以及整体 UI 打磨，使应用达到可用的产品级体验。

核心挑战：**流式 Markdown 渲染性能**——streaming chunks 每 20-50ms 到达一次，需要节流以避免 react-markdown 频繁重新解析导致的卡顿。

---

## 新增依赖

```bash
pnpm add react-markdown remark-gfm shiki
```

- `react-markdown` — 将 Markdown 渲染为 React 元素，支持自定义组件覆盖
- `remark-gfm` — GFM 扩展（表格、删除线、任务列表、自动链接）
- `shiki` — VS Code 级别的语法高亮，支持 WASM web bundle、双主题

无需额外类型包，三个库均自带 TypeScript 声明。

---

## 实施步骤（按依赖顺序）

### Step 1: Shiki 高亮器单例 + CodeBlock 组件

**新建 `src/renderer/src/lib/shiki.ts`**

- 使用 `createHighlighter` from `shiki`（web-compatible WASM bundle）
- 单例模式：首次调用初始化，后续复用同一 Promise
- 预加载常用语言：js, ts, python, json, html, css, bash, markdown, sql, jsx, tsx
- 加载双主题：`github-dark` + `github-light`
- 导出 `highlightCode(code, lang, theme)` 异步辅助函数
  - 检查语言是否已加载，未加载则惰性加载（失败回退到 `text`）
  - 返回 shiki 生成的 HTML 字符串

**新建 `src/renderer/src/components/chat/CodeBlock.tsx`**

- Props: `{ code: string; language: string }`
- `useState` 存储高亮后的 HTML，`useEffect` 调用 `highlightCode()`
- 通过 `useTheme()` 获取当前主题（dark/light），主题变化时重新高亮
- 加载中时显示纯文本 `<pre><code>` 回退
- 高亮 HTML 通过 `dangerouslySetInnerHTML` 渲染（shiki 输出安全的 `<span>` 标签）
- 顶部栏：左侧语言名称 + 右侧复制按钮（`Copy`/`Check` icon，2 秒反馈）
- 容器样式：`rounded-lg border bg-muted/50 overflow-hidden`
- 用 `React.memo` 包裹

### Step 2: MarkdownRenderer 组件

**新建 `src/renderer/src/components/chat/MarkdownRenderer.tsx`**

- Props: `{ content: string }`
- 使用 `react-markdown` + `remarkGfm` 插件
- 自定义 `components` 覆盖：
  - `code` — 区分行内代码和代码块：代码块渲染 `<CodeBlock />`，行内代码渲染带背景的 `<code>`
  - `pre` — 渲染 `{children}` 避免与 CodeBlock 双重嵌套
  - `a` — `target="_blank" rel="noopener noreferrer"` + `text-primary underline`
  - `table` — 外层 `overflow-x-auto`，表格 `border-collapse border`
  - `th/td` — `border px-3 py-2`，th 加 `bg-muted font-medium`
  - `ul/ol` — `list-disc`/`list-decimal` + `ml-6 my-2 space-y-1`
  - `blockquote` — `border-l-4 border-primary/30 pl-4 italic`
  - `h1-h6` — 适当大小 + `font-semibold`
  - `p` — `my-2 leading-relaxed`
  - `hr` — 使用已有 `<Separator />` 组件
- 用 `React.memo` 包裹

### Step 3: 流式 Markdown 性能优化

**新建 `src/renderer/src/hooks/useThrottledValue.ts`**

- `useThrottledValue<T>(value: T, isActive: boolean): T`
- `isActive=true` 时：用 `requestAnimationFrame` 节流，每帧最多更新一次（~16ms）
- `isActive=false` 时：直接返回原值（非流式读取无延迟）
- 流式结束时立即 flush 最终值，确保不丢数据

**集成于 MessageList.tsx**：

```tsx
const throttledContent = useThrottledValue(streamingContent, isStreaming)
// 传递 throttledContent 给 streaming MessageBubble
```

### Step 4: MessageBubble 升级 + 消息操作

**修改 `src/renderer/src/components/chat/MessageBubble.tsx`**

- 新增 Props: `messageId?: string`, `onDelete?: (id: string) => void`
- **assistant 消息**：用 `<MarkdownRenderer content={content} />` 替代纯文本，移除 `whitespace-pre-wrap`
- **user 消息**：保持纯文本 `whitespace-pre-wrap`
- **流式光标**：保留现有 `animate-pulse` 光标
- **hover 操作栏**：非流式消息 hover 时显示浮动工具栏
  - 容器用 `group` class，工具栏 `opacity-0 group-hover:opacity-100 transition-opacity`
  - 绝对定位于消息气泡右上角
  - 按钮：Copy（复制内容到剪贴板，2 秒反馈）+ Delete（调用 onDelete）
- 用 `React.memo` 包裹

**修改 `src/renderer/src/stores/conversationStore.ts`**

- 新增 `deleteMessage(id: string)` action
- 调用已有的 `window.api.deleteMessage(id)` IPC（preload 和 main handler 已就绪）
- 成功后从 `messages[]` 中过滤移除

**修改 `src/renderer/src/components/chat/MessageList.tsx`**

- 使用 `useThrottledValue` 节流 streamingContent
- 向 MessageBubble 传递 `messageId` 和 `onDelete`
- 从 conversationStore 获取 `deleteMessage` action

### Step 5: UI 打磨

#### 5a: 欢迎页面增强

**新建 `src/renderer/src/components/chat/WelcomeScreen.tsx`**

- 居中卡片：标题 "Welcome to AI Studio" + 副标题
- 3 个建议卡片（用 `Button variant="outline"`）：
  - "Explain a concept"（`Lightbulb` icon）
  - "Help me write code"（`Code2` icon）
  - "Brainstorm ideas"（`MessageSquare` icon）
- 点击建议 → 创建对话 + 发送该 prompt
- Props: `onSend: (content: string) => void`

**修改 MessageList.tsx**：用 `<WelcomeScreen />` 替代现有的简单欢迎文本

#### 5b: 侧边栏折叠/展开

**修改 `src/renderer/src/components/layout/AppLayout.tsx`**

- 新增 `sidebarCollapsed` state，持久化到 localStorage
- 折叠时 sidebar 从 `w-70` 过渡到 `w-0 overflow-hidden`
- 使用 `transition-all duration-300` 平滑动画

**修改 `src/renderer/src/components/layout/Sidebar.tsx`**

- 接收 `collapsed` 和 `onToggle` props
- header 区域添加折叠按钮（`PanelLeftClose` icon）

**修改 `src/renderer/src/components/chat/ChatView.tsx`**

- 接收 `sidebarCollapsed` 和 `onToggleSidebar` props
- 侧边栏折叠时，header 左侧显示展开按钮（`PanelLeftOpen` icon）

#### 5c: 自动滚动 + "跳到底部" 按钮

**新建 `src/renderer/src/hooks/useAutoScroll.ts`**

- 用 `IntersectionObserver` 监测底部哨兵元素，追踪 `isAtBottom`
- 仅在用户已在底部时自动滚动（尊重用户滚动回看历史）
- 导出 `scrollToBottom()` 方法（smooth 行为）

**修改 MessageList.tsx**：

- 替换现有 `scrollIntoView` 逻辑为 `useAutoScroll`
- `!isAtBottom` 时在消息区底部中央显示 "跳到底部" 浮动按钮（`ChevronDown` icon，`rounded-full shadow-lg`）

#### 5d: 加载动画

**修改 MessageList.tsx**：

- 当 `isLoading=true`（切换对话加载消息时）显示脉动点动画
- 从 conversationStore 获取已有的 `isLoading` 状态

#### 5e: 键盘快捷键

**新建 `src/renderer/src/hooks/useKeyboardShortcuts.ts`**

- 在 `document` 上注册 `keydown` 监听器（app-scoped，非 globalShortcut）
- `Ctrl+N` → 新建对话（`e.preventDefault()` 防止浏览器默认行为）
- `Ctrl+,` → 打开设置
- `Escape` → 停止生成

**修改 `src/renderer/src/stores/settingsStore.ts`**

- 新增 `dialogOpen: boolean` + `setDialogOpen: (open: boolean) => void`
- 使 Sidebar 和键盘快捷键都能控制 SettingsDialog

**修改 `src/renderer/src/components/layout/Sidebar.tsx`**

- 用 `useSettingsStore(s => s.dialogOpen)` 替代本地 `useState(false)` 管理 settingsOpen

**修改 `src/renderer/src/App.tsx`**

- 调用 `useKeyboardShortcuts` hook，连接 store actions

### Step 6: CSS 更新

**修改 `src/renderer/src/assets/main.css`**

- 添加 `.shiki { background-color: transparent !important; }` 覆盖 shiki 内置背景色
- 添加 `.markdown-body > :first-child { margin-top: 0; }` 和 `:last-child { margin-bottom: 0; }` 清理 prose 间距

---

## 文件变更汇总

### 新建文件（6 个）

| 文件                                                    | 用途                                      |
| ------------------------------------------------------- | ----------------------------------------- |
| `src/renderer/src/lib/shiki.ts`                         | Shiki 高亮器单例 + highlightCode 辅助函数 |
| `src/renderer/src/components/chat/CodeBlock.tsx`        | 代码块：语法高亮 + 语言标签 + 复制按钮    |
| `src/renderer/src/components/chat/MarkdownRenderer.tsx` | react-markdown 封装 + 自定义元素渲染      |
| `src/renderer/src/components/chat/WelcomeScreen.tsx`    | 增强版欢迎页 + 建议卡片                   |
| `src/renderer/src/hooks/useThrottledValue.ts`           | RAF 节流 hook（流式渲染优化）             |
| `src/renderer/src/hooks/useAutoScroll.ts`               | IntersectionObserver 自动滚动 hook        |
| `src/renderer/src/hooks/useKeyboardShortcuts.ts`        | 全局键盘快捷键 hook                       |

### 修改文件（8 个）

| 文件                                                 | 变更                                                                  |
| ---------------------------------------------------- | --------------------------------------------------------------------- |
| `src/renderer/src/components/chat/MessageBubble.tsx` | MarkdownRenderer 集成 + hover 操作栏 + React.memo                     |
| `src/renderer/src/components/chat/MessageList.tsx`   | 节流流式内容 + 跳到底部按钮 + WelcomeScreen + 加载动画 + 传递新 props |
| `src/renderer/src/components/chat/ChatView.tsx`      | 侧边栏折叠按钮 + 传递新 props                                         |
| `src/renderer/src/components/layout/AppLayout.tsx`   | 侧边栏折叠状态 + 动画过渡 + localStorage 持久化                       |
| `src/renderer/src/components/layout/Sidebar.tsx`     | 接收 collapsed/onToggle props + 折叠按钮 + 设置 dialog 状态改用 store |
| `src/renderer/src/stores/conversationStore.ts`       | 新增 deleteMessage action                                             |
| `src/renderer/src/stores/settingsStore.ts`           | 新增 dialogOpen / setDialogOpen                                       |
| `src/renderer/src/App.tsx`                           | 集成 useKeyboardShortcuts hook                                        |
| `src/renderer/src/assets/main.css`                   | shiki 背景覆盖 + markdown prose 间距                                  |

### 无需修改

- Main process（`src/main/`）— 所有 Phase 6 功能都在 renderer 端，keyboard shortcuts 使用 DOM 监听
- Preload（`src/preload/`）— `deleteMessage` 已暴露
- Shared types（`src/shared/`）— 无需新 IPC 通道或类型

---

## 验证清单

### Markdown 渲染

- [ ] 标题 h1-h6 层级正确
- [ ] 粗体/斜体/删除线正确渲染
- [ ] 有序/无序/嵌套列表正确缩进
- [ ] 链接在系统浏览器中打开
- [ ] 表格带边框 + 宽表格可横向滚动
- [ ] 引用块有左侧边框样式
- [ ] 行内代码有背景高亮
- [ ] 分隔线渲染为 Separator

### 代码高亮

- [ ] 代码块显示语言标签
- [ ] JS/TS/Python/JSON 等主流语言正确高亮
- [ ] 未知语言回退到纯文本，无报错
- [ ] 复制按钮复制代码到剪贴板 + "Copied" 反馈
- [ ] 深色主题用 github-dark，浅色主题用 github-light
- [ ] 切换主题时代码块重新高亮
- [ ] 长行代码块可横向滚动

### 流式性能

- [ ] 流式 Markdown 渲染流畅无卡顿（RAF 节流）
- [ ] 长回复（500+ token）不出现明显掉帧
- [ ] 流结束后内容完整无截断
- [ ] 中途停止生成正确渲染部分 Markdown

### 消息操作

- [ ] hover 显示操作工具栏
- [ ] Copy 按钮复制消息内容
- [ ] Delete 按钮从 UI 和数据库中移除消息
- [ ] 流式消息不显示操作按钮

### 欢迎页面

- [ ] 无对话时显示欢迎页 + 建议卡片
- [ ] 点击建议创建对话并发送 prompt

### 侧边栏折叠

- [ ] 折叠按钮平滑动画收起侧边栏
- [ ] 聊天区 header 显示展开按钮
- [ ] 折叠状态跨重启持久化

### 自动滚动

- [ ] 流式时在底部自动滚动
- [ ] 用户向上滚动时不强制回到底部
- [ ] 非底部时显示 "跳到底部" 按钮
- [ ] 点击按钮平滑滚到底部

### 键盘快捷键

- [ ] Ctrl+N 新建对话
- [ ] Ctrl+, 打开设置
- [ ] Escape 停止生成
- [ ] 快捷键不干扰文本输入

### 主题兼容

- [ ] 深色/浅色模式下所有新组件渲染正确
- [ ] `pnpm typecheck` 零错误
- [ ] `pnpm lint` 零错误
