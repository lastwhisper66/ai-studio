# AI Studio - 从零搭建到完整实现的详细计划

## Context

AI Studio 是一个 Windows 桌面 AI 聊天应用，基于 Electron + React 19。本计划将项目分为 **7 个递增交付阶段**，每个阶段结束后应用都可运行。

---

## 进度总览

| 阶段       | 状态      |
| ---------- | --------- |
| 1. 脚手架  | ✅ 已完成 |
| 2. UI 基础 | ✅ 已完成 |
| 3. 数据层  | ✅ 已完成 |
| 4. AI 核心 | ✅ 已完成 |
| 5. 设置    | ✅ 已完成 |
| 6. 渲染    | ✅ 已完成 |
| 7. 发布    | 🔲 未开始 |

---

## 阶段一：项目脚手架与基础框架 ✅

**目标**：建立 electron-vite 三进程骨架，`pnpm dev` 可启动空白 Electron 窗口。

### 步骤

1. ✅ **初始化项目** - 使用 `pnpm create @quick-start/electron` 脚手架（react-ts 模板），生成的文件合并到当前目录（保留已有 CLAUDE.md 和 .claude/）
2. ✅ **调整 `package.json`** - name=`ai-studio`，scripts 含 dev/build/typecheck/lint
3. ✅ **配置 TypeScript** - 三个 tsconfig（根、node、web），strict 通过继承 `@electron-toolkit/tsconfig` 启用
4. ✅ **配置 `electron.vite.config.ts`** - renderer 用 `@vitejs/plugin-react` + `@tailwindcss/vite` + `@renderer` 路径别名
5. ✅ **编写最小入口**：
   - `src/main/index.ts` - 创建 BrowserWindow（1200x800），加载 renderer
   - `src/preload/index.ts` - contextBridge 占位（暴露空 `api` 对象）
   - `src/renderer/src/App.tsx` - 显示 "AI Studio" 标题
6. ✅ **配置 `electron-builder.yml`** - Windows NSIS 打包，appId=`com.ai-studio.app`
7. ✅ **配置 ESLint + Prettier + `.gitignore`** - ESLint flat config（TS+React+Prettier）

### 依赖

```
核心：electron, electron-vite, @vitejs/plugin-react, typescript, react, react-dom, vite
工具：@electron-toolkit/preload, @electron-toolkit/utils
构建：electron-builder
样式：tailwindcss, @tailwindcss/vite
Lint/格式化：eslint, prettier, eslint-plugin-react, eslint-plugin-react-hooks, eslint-plugin-react-refresh
类型：@types/node, @types/react, @types/react-dom
```

### 验证

- ✅ `pnpm dev` → Electron 窗口显示 "AI Studio"
- ✅ `pnpm typecheck` / `pnpm lint` 无错误

---

## 阶段二：Tailwind CSS v4 + Shadcn/UI + 基础布局 ✅

**目标**：集成样式系统，实现左右分栏聊天界面骨架（静态）。

### 步骤

1. ✅ **配置 Tailwind CSS v4 样式** - `@tailwindcss/vite` 插件配置在 `electron.vite.config.ts` 的 renderer 部分
2. ✅ **创建 `src/renderer/src/assets/main.css`** - `@import "tailwindcss"` + `@import "tw-animate-css"` + `@theme inline` 定义 oklch 色彩空间设计令牌 + `:root` 浅色变量 + `.dark` 深色变量
3. ✅ **初始化 Shadcn/UI** - `components.json` 配置 new-york 风格，aliases 指向 `@renderer/` 路径。根 `tsconfig.json` 需添加 `paths: { "@renderer/*": ["src/renderer/src/*"] }` 以确保 Shadcn CLI 正确解析路径
4. ✅ **安装 Shadcn 组件** - button, input, scroll-area, separator, tooltip, dialog, dropdown-menu, textarea, avatar（共 9 个，使用 radix-ui 统一包 v1.4.3）
5. ✅ **创建布局组件**：
   - `src/renderer/src/components/layout/AppLayout.tsx` - flex 两栏布局（`flex h-screen w-screen overflow-hidden`）
   - `src/renderer/src/components/layout/Sidebar.tsx` - 左侧 280px（`w-70`），使用 sidebar 专用色彩令牌，含新建对话按钮 + ScrollArea 对话列表 + 底部主题切换/设置按钮
   - `src/renderer/src/components/layout/ChatPanel.tsx` - 右侧 flex-1，含标题栏 + ScrollArea 消息区 + Textarea 输入区
6. ✅ **实现主题切换**：
   - `src/renderer/src/components/theme/ThemeContext.ts` - Theme 类型（light | dark | system）+ Context 定义
   - `src/renderer/src/components/theme/ThemeProvider.tsx` - class 策略切换 `<html>` 的 `dark` class，支持 system 媒体查询，localStorage 持久化
   - `src/renderer/src/hooks/useTheme.ts` - useContext 封装 hook
   - `src/renderer/src/main.tsx` - ThemeProvider > TooltipProvider > App 嵌套
7. ✅ **创建 `src/renderer/src/lib/utils.ts`** - `cn()` 工具函数（clsx + tailwind-merge）

### 依赖

```
tw-animate-css ^1.4.0, lucide-react ^0.577.0
class-variance-authority ^0.7.1, clsx ^2.1.1, tailwind-merge ^3.5.0
radix-ui ^1.4.3（统一包，替代独立 @radix-ui/* 包）
```

### 验证

- ✅ `pnpm dev` → 左右分栏布局可见
- ✅ 主题切换正常（深色/浅色/跟随系统）
- ✅ Shadcn Button 等组件渲染正常

### 备注

- Shadcn CLI 仅读取根 `tsconfig.json` 的 `paths` 解析别名。electron-vite 项目中实际 paths 定义在 `tsconfig.web.json`，需在根 tsconfig 中冗余声明以兼容 Shadcn CLI
- Tailwind v4 使用 CSS-first 配置，无 `tailwind.config.js`，设计令牌通过 `@theme` 指令定义

---

## 阶段三：IPC 通信 + SQLite 数据库 + 对话管理

**目标**：建立类型安全 IPC 层，集成 SQLite，实现对话 CRUD。

### 数据库 Schema

```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'New Chat',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  model TEXT,
  system_prompt TEXT
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  token_count INTEGER,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_conversations_updated ON conversations(updated_at);
```

### 步骤

1. **安装 better-sqlite3** + `@types/better-sqlite3`，配置 `asarUnpack` in `electron-builder.yml`
2. **创建共享类型 `src/shared/`**：
   - `types.ts` - Conversation, Message, ApiSettings 接口
   - `ipc-channels.ts` - IPC 通道常量（`conversation:list`, `conversation:create` 等）
3. **创建数据库模块 `src/main/db/`**：
   - `index.ts` - 初始化（`app.getPath('userData')` + WAL 模式 + 外键）
   - `schema.ts` - 建表语句
   - `conversations.ts` - 对话 CRUD
   - `messages.ts` - 消息 CRUD
   - `settings.ts` - 键值读写
4. **创建 IPC Handlers `src/main/ipc/`**：
   - `index.ts` - 统一注册
   - `conversation.ts` - 对话相关 `ipcMain.handle()`
   - `message.ts` - 消息相关
   - `settings.ts` - 设置相关
5. **完善 Preload `src/preload/index.ts`** - 通过 contextBridge 暴露所有 API 方法
6. **添加类型声明 `src/preload/index.d.ts`** - 声明 `window.api` 类型
7. **创建 Zustand store `src/renderer/src/stores/conversationStore.ts`** - 对话列表状态 + CRUD actions
8. **实现 Sidebar UI** - 新建对话按钮 + 对话列表 + 删除/重命名

### 依赖

```
better-sqlite3, uuid
@types/better-sqlite3, @types/uuid
```

### 验证

- 新建对话 → 左侧列表出现
- 重启应用 → 对话列表持久化
- 删除/重命名对话正常
- 检查 `%APPDATA%/ai-studio/ai-studio.db` 存在

---

## 阶段四：AI 对话核心 - OpenAI 集成与流式响应

**目标**：集成 OpenAI API，实现消息发送和流式打字机效果。

### 关键技术方案：Streaming over IPC

```
Main Process                           Renderer Process
─────────────                          ─────────────────
ipcMain.handle('chat:send-message')    window.api.sendMessage() [invoke]
  → openai.chat.completions.create()
  → for await (chunk of stream)
      webContents.send('chat:stream-chunk', delta)  → ipcRenderer.on() → zustand store
  → webContents.send('chat:stream-end')             → 最终化消息

AbortController → 支持用户中断生成
```

### 步骤

1. **安装 openai SDK** - `pnpm add openai`
2. **创建 AI 模块 `src/main/ai/`**：
   - `openai-client.ts` - `new OpenAI({ apiKey, baseURL })`
   - `azure-client.ts` - `new AzureOpenAI({ endpoint, apiKey, apiVersion })`
   - `index.ts` - 根据设置选择客户端的工厂函数
3. **实现流式聊天 Handler `src/main/ipc/chat.ts`**：
   - 保存用户消息 → 加载对话历史 → 创建客户端 → `stream: true` 请求
   - `for await` 迭代 + `webContents.send()` 逐块推送
   - `AbortController` 支持中断
   - 流结束后保存 assistant 完整消息到数据库
4. **完善 Preload** - 添加 `onStreamChunk`、`onStreamEnd`、`onStreamError`、`stopGeneration`、`removeStreamListeners`
5. **创建 chatStore `src/renderer/src/stores/chatStore.ts`**：
   - messages 数组 + isStreaming 状态 + streamingContent 聚合
   - sendMessage：乐观更新 → 注册监听器 → 调用 API → chunk 聚合 → 最终化
6. **创建聊天 UI 组件 `src/renderer/src/components/chat/`**：
   - `ChatView.tsx` - 聊天主视图容器
   - `MessageList.tsx` - 消息列表（ScrollArea + 自动滚动）
   - `MessageBubble.tsx` - 单条消息（此阶段纯文本）
   - `MessageInput.tsx` - 多行输入（Enter 发送 / Shift+Enter 换行 / 停止按钮）
7. **自动标题生成** - 第一条消息后用非流式请求让 AI 生成简短标题

### 依赖

```
openai
```

### 验证

- 输入消息 → AI 逐字流式回复
- 停止按钮可中断
- 重启后消息历史保留
- 切换对话加载正确历史

---

## 阶段五：设置页面 - API 配置与持久化

**目标**：完整设置 UI，支持 OpenAI / Azure OpenAI 切换和连接测试。

### 步骤

1. **创建 settingsStore** - `src/renderer/src/stores/settingsStore.ts`
2. **实现安全存储** - 使用 Electron `safeStorage` 加密 API Key（不可用时 fallback 明文）
3. **创建设置 UI `src/renderer/src/components/settings/`**：
   - `SettingsDialog.tsx` - Shadcn Dialog 容器
   - `ProviderSelect.tsx` - OpenAI / Azure 切换
   - `OpenAISettings.tsx` - API Key + Base URL + Model 选择
   - `AzureSettings.tsx` - Endpoint + API Key + API Version + Deployment
   - `ModelSettings.tsx` - Temperature 滑块 + Max Tokens
   - `ConnectionTest.tsx` - 测试按钮 + 结果显示
4. **添加连接测试 IPC** - `settings:test-connection` 通道
5. **Sidebar 底部齿轮按钮** 打开设置 Dialog
6. **安装额外 Shadcn 组件** - dialog, tabs, select, slider, label, switch

### 验证

- 设置页面可打开，切换 Provider
- 填入配置 → 测试连接成功/失败
- 保存后重启配置保留
- 用保存的配置正常对话

---

## 阶段六：Markdown 渲染 + 代码高亮 + UI 打磨

**目标**：AI 回复支持 Markdown + 代码高亮，整体 UI 打磨。

### 步骤

1. **安装渲染依赖** - `react-markdown`, `remark-gfm`, `shiki`
2. **创建 `MarkdownRenderer.tsx`** - react-markdown + remark-gfm，自定义 code/link/table 渲染
3. **创建 `CodeBlock.tsx`** - shiki 语法高亮 + 语言标签 + 复制按钮 + 主题适配
4. **更新 MessageBubble** - assistant 消息用 MarkdownRenderer
5. **流式 Markdown 优化** - `requestAnimationFrame` 节流渲染
6. **UI 打磨**：
   - 空状态欢迎页
   - 消息操作菜单（复制/删除）
   - 侧边栏折叠/展开
   - 加载动画
   - 自动滚动 + "跳到底部" 按钮
7. **键盘快捷键** - Ctrl+N（新建）、Ctrl+,（设置）、Escape（停止生成）

### 依赖

```
react-markdown, remark-gfm, shiki
```

### 验证

- Markdown 标题/列表/粗体/表格渲染正确
- 代码块语法高亮 + 复制可用
- 流式渲染无卡顿
- 深色/浅色主题适配

---

## 阶段七：打包发布 + 最终优化

**目标**：生产构建、Windows 安装包、性能优化。

### 步骤

1. **准备应用图标** - `build/icon.ico` (256x256)
2. **完善 `electron-builder.yml`** - icon 路径、NSIS 配置、asar + asarUnpack
3. **安全加固** - `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, CSP 配置
4. **生产优化**：
   - 单实例锁 `app.requestSingleInstanceLock()`
   - 窗口状态记忆（大小/位置）
   - 生产环境禁用 DevTools
   - React 懒加载（设置 Dialog 等）
5. **性能优化** - 虚拟列表（长消息历史）、数据库分页、shiki 高亮器预编译
6. **打包测试** - `pnpm build:win` 生成 .exe，安装验证

### 验证

- `pnpm build:win` → 生成安装包
- 安装后全功能正常
- 数据持久化正常
- 内存占用合理

---

## 完整目录结构

```
F:/work/ai-studio/
├── build/icon.ico
├── src/
│   ├── main/
│   │   ├── index.ts                  # 入口：窗口创建、app 生命周期
│   │   ├── ai/
│   │   │   ├── index.ts              # 客户端工厂
│   │   │   ├── openai-client.ts
│   │   │   └── azure-client.ts
│   │   ├── db/
│   │   │   ├── index.ts              # DB 连接、初始化
│   │   │   ├── schema.ts             # 建表
│   │   │   ├── conversations.ts
│   │   │   ├── messages.ts
│   │   │   └── settings.ts
│   │   └── ipc/
│   │       ├── index.ts              # 统一注册
│   │       ├── conversation.ts
│   │       ├── chat.ts               # 流式核心
│   │       ├── message.ts
│   │       └── settings.ts
│   ├── preload/
│   │   ├── index.ts                  # contextBridge API
│   │   └── index.d.ts               # window.api 类型
│   ├── renderer/
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       ├── assets/main.css       # Tailwind v4 CSS
│   │       ├── components/
│   │       │   ├── ui/               # Shadcn 组件
│   │       │   ├── layout/           # AppLayout, Sidebar, ChatPanel
│   │       │   ├── chat/             # ChatView, MessageList, MessageBubble, MessageInput, MarkdownRenderer, CodeBlock
│   │       │   ├── settings/         # SettingsDialog, ProviderSelect, OpenAISettings, AzureSettings, ModelSettings
│   │       │   └── theme/            # ThemeProvider
│   │       ├── stores/               # conversationStore, chatStore, settingsStore
│   │       ├── hooks/                # useTheme, useAutoScroll
│   │       └── lib/utils.ts          # cn()
│   └── shared/
│       ├── types.ts                  # 数据模型接口
│       └── ipc-channels.ts           # IPC 通道常量
├── CLAUDE.md
├── plans/PLAN.md                     # 本计划文件
├── electron.vite.config.ts
├── electron-builder.yml
├── package.json
├── components.json                   # Shadcn 配置
├── tsconfig.json / tsconfig.node.json / tsconfig.web.json
└── .gitignore
```

---

## 实施顺序总结

| 阶段       | 状态      | 核心交付物                   | 关键难点                            |
| ---------- | --------- | ---------------------------- | ----------------------------------- |
| 1. 脚手架  | ✅ 已完成 | 空白 Electron 窗口           | electron-vite 配置                  |
| 2. UI 基础 | ✅ 已完成 | Tailwind + Shadcn + 分栏布局 | Tailwind v4 CSS-first + Shadcn 兼容 |
| 3. 数据层  | ✅ 已完成 | SQLite + IPC + 对话 CRUD     | better-sqlite3 native rebuild       |
| 4. AI 核心 | ✅ 已完成 | 流式对话                     | OpenAI streaming over IPC           |
| 5. 设置    | ✅ 已完成 | API 配置页面                 | safeStorage 加密                    |
| 6. 渲染    | ✅ 已完成 | Markdown + 代码高亮          | 流式 Markdown 性能                  |
| 7. 发布    | 🔲 未开始 | Windows 安装包               | 安全加固 + 打包配置                 |
