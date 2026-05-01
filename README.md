# AI Studio

基于 Electron + React 构建的桌面端 AI 对话应用。支持多服务商接入、流式响应、助手系统、翻译功能、本地持久化存储，提供流畅的原生桌面体验。

![Electron](https://img.shields.io/badge/Electron-39-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-WAL-003B57?logo=sqlite&logoColor=white)

## 功能特性

### 💬 AI 对话

- **多服务商支持** — OpenAI / Azure OpenAI / OpenAI Response API / Anthropic Claude / Google Gemini / DeepSeek / SiliconFlow / NewAPI / 自定义兼容接口
- **流式响应** — 实时逐字输出，独立的推理（Reasoning）通道，支持随时停止生成
- **自动标题** — AI 自动为会话生成简洁标题
- **扩展思维** — 支持 Reasoning Level 调节（Low / Medium / High / XHigh），思考过程独立展示并计时
- **文件附件** — 支持图片（jpg/png/gif/webp）、文本（txt/md/csv/json）、PDF，单文件最大 10MB，图片内联预览
- **Markdown 渲染** — Shiki 语法高亮、Mermaid 流程图、KaTeX 数学公式、表格、任务列表、上下标，图片支持缩放预览

### 🤖 助手系统

- 创建多个命名助手，各自独立绑定服务商、模型和系统提示词
- 可配置生成参数：Temperature、Top P、Max Completion Tokens、Context Count
- 支持提示词建议（Prompt Suggestions）
- 助手置顶、分组、复制

### ⚡ 快速助手 (Quick Assistant)

- 全局快捷键 `Ctrl+Shift+Space` 唤出浮动小窗，独立于主窗口
- 内建动作：问答 / 翻译 / 总结 / 图片翻译，可自定义任意 Action
- 支持图片附件、置顶、窗口大小记忆
- 与截图翻译联动：`Alt+P` 截屏后自动喂入图片翻译动作

### ✂️ 划词助手 (Selection Assistant)

- 基于 `selection-hook` 的 Windows 全局划词，任意应用中选中文本即可弹出工具栏
- 工具栏点击动作 → 在原位弹出结果气泡，支持流式输出 / 置顶 / 拖拽缩放
- 内建动作：翻译 / 解释 / 总结 / 改写 / 搜索（搜索引擎可配置：Google / Bing / Baidu / DuckDuckGo）
- 触发模式：选中即弹出 或 按住 Ctrl 才弹出
- 程序排除列表 + 最小/最大文本长度阈值
- 不可用辅助接口的应用（PDF 阅读器等）支持剪贴板回退

### 📷 截图翻译

- 全局快捷键 `Alt+P` 触发区域截屏
- 截屏图片自动塞入 Quick Assistant 的图片翻译动作，零额外操作

### 🌐 翻译功能

- 独立的翻译视图，可选择不同于对话的服务商和模型
- 支持中文、英文、日文互译，自动检测源语言
- 流式翻译输出、自定义翻译提示词和 Temperature
- 翻译历史记录

### 📝 会话管理

- 多会话并行管理，支持会话置顶
- 历史消息分页加载
- 快捷短语库 — 保存常用提示词模板，一键插入输入框
- 会话级系统提示词设置

### 🎨 主题与外观

- **6 套色彩主题** — Default / Mint / Lavender / Ocean / Amber / Rose
- **3 种模式** — 亮色 / 暗色 / 跟随系统
- 基于 oklch 色彩空间的现代配色方案

### 🌍 国际化

- 中文（zh-CN）/ 英文（en）双语支持
- 自动检测系统语言

### 🔒 安全

- API Key 通过 Electron safeStorage 加密存储
- Context Isolation + Sandbox 沙箱模式
- 所有 IPC 通过 contextBridge 安全桥接，不暴露 ipcRenderer

### 📚 模型库

- 内置预配置模型定义（GPT / Claude / Gemini / DeepSeek 等）
- 模型能力标签：Reasoning、Vision、Tools、Web、Free、Embedding、Reranking
- 支持自定义模型添加与能力编辑
- 远程模型拉取（`/v1/models`）+ 模型分组规则（正则匹配模型名 → 显示分组名）
- API 连接测试

### ⌨️ 键盘快捷键

全部支持在 **设置 → 快捷键** 中自定义。

| 快捷键                         | 作用域 | 功能                                  |
| ------------------------------ | ------ | ------------------------------------- |
| `Ctrl+N`                       | 应用内 | 新建会话                              |
| `Ctrl+,`                       | 应用内 | 打开/关闭设置                         |
| `Ctrl+B`                       | 窗口   | 切换助手侧栏                          |
| `Ctrl+Shift+B`                 | 窗口   | 切换话题面板                          |
| `Escape`                       | 对话   | 停止生成                              |
| `Alt+A`                        | 全局   | 呼出主窗口                            |
| `Ctrl+Shift+Space`             | 全局   | 切换 Quick Assistant                  |
| `Alt+P`                        | 全局   | 截图翻译                              |
| `Alt+H`                        | 全局   | 切换划词助手                          |
| `Ctrl+=` / `Ctrl+-` / `Ctrl+0` | 窗口   | 缩放 / 重置缩放（也支持 `Ctrl+滚轮`） |

## 技术栈

| 类别     | 技术                                                                                                 |
| -------- | ---------------------------------------------------------------------------------------------------- |
| 运行时   | Electron 39 + React 19                                                                               |
| 语言     | TypeScript（strict mode，main/preload 与 renderer 各有独立 tsconfig）                                |
| 构建     | electron-vite（Vite）                                                                                |
| UI 框架  | Shadcn/UI (Radix UI) + Tailwind CSS v4 + tw-animate-css + Lucide Icons                               |
| 状态管理 | Zustand 5                                                                                            |
| 数据库   | better-sqlite3（WAL 模式，外键约束开启）                                                             |
| AI SDK   | `openai`（OpenAI / Azure / DeepSeek / SiliconFlow / NewAPI）+ `@anthropic-ai/sdk` + `@google/genai`  |
| Markdown | react-markdown + remark-gfm + remark-math + Shiki 语法高亮 + Mermaid 流程图 + KaTeX 公式             |
| 多窗口   | 单 bundle + URL `?mode=` 路由（main / quick-assistant / screenshot / selection-toolbar / -bubble）   |
| 原生扩展 | `selection-hook`（Windows 划词钩子）+ `node-screenshots`（屏幕截图）                                 |
| 交互组件 | @dnd-kit（拖拽排序）+ react-zoom-pan-pinch（图片缩放）+ emoji-mart（Emoji 选择器）+ cmdk（命令面板） |
| 国际化   | i18next + react-i18next + i18next-browser-languagedetector                                           |
| 包管理   | npm（postinstall 自动 electron-rebuild better-sqlite3）                                              |

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) >= 18
- npm

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

### 其他命令

```bash
npm run lint              # ESLint 检查
npm run format            # Prettier 格式化
npm run typecheck         # 全量 TypeScript 类型检查
npm run typecheck:node    # 仅检查主进程 + preload
npm run typecheck:web     # 仅检查渲染进程
```

## 项目结构

```
src/
├── main/                          # 主进程（Node.js）
│   ├── index.ts                   #   入口：单例锁、托盘、全局快捷键、窗口状态持久化
│   ├── app-state.ts               #   启动期设置（关闭到托盘 / 自启 / 拼写检查 / 各助手开关）
│   ├── i18n.ts                    #   主进程 i18n（托盘 + 对话框文案）
│   ├── screenshot.ts              #   区域截屏 → Quick Assistant 自动执行
│   ├── quick-assistant-window.ts  #   Quick Assistant 浮窗（预创建）
│   ├── selection-toolbar-window.ts#   划词工具栏窗口（预创建）
│   ├── selection-bubble-window.ts #   划词结果气泡窗口（预创建）
│   ├── selection-service.ts       #   selection-hook 单例 + 过滤 + 坐标转换
│   ├── ai/                        #   流式派发：OpenAI / OpenAI-Response / Gemini / Claude
│   ├── db/                        #   SQLite（11 张表 + 种子数据）
│   ├── ipc/                       #   IPC handlers（按 domain 拆分，21 个文件）
│   └── utils/                     #   路径 / 通知 / 窗口大小持久化
├── preload/                       # contextBridge 安全桥接（typed window.api）
├── renderer/src/
│   ├── main.tsx                   #   ?mode= 路由：App / QuickAssistant / Screenshot / SelectionToolbar / SelectionBubble
│   ├── App.tsx                    #   主 App，挂载 stores、键盘快捷键、缩放、i18n 同步
│   ├── components/
│   │   ├── chat/                  #     聊天视图、Markdown / Mermaid / Math 渲染、附件、思考块
│   │   ├── layout/                #     主布局、侧栏、话题面板、标题栏
│   │   ├── settings/              #     设置面板（11 个分组：服务商 / 模型库 / 模型分组 / 通用 / 网络 / 显示 / 数据 / 短语 / 快捷键 / 快速助手 / 划词助手）
│   │   ├── translate/             #     独立翻译视图
│   │   ├── theme/                 #     6 套色彩主题（oklch）
│   │   ├── quick-assistant/       #     Quick Assistant 渲染端
│   │   ├── selection-toolbar/     #     划词工具栏渲染端
│   │   ├── selection-bubble/      #     划词结果气泡渲染端
│   │   ├── screenshot/            #     截图覆盖层
│   │   └── ui/                    #     Shadcn/UI 基础组件
│   ├── stores/                    #   10 个 Zustand store
│   ├── hooks/                     #   自定义 Hooks（快捷键 / 自动滚动 / 字体 / 头像 / 错误本地化等）
│   ├── i18n/                      #   en / zh-CN 资源
│   └── lib/                       #   shiki、模型分组推断、cn 工具
└── shared/                        # 类型 / IPC 通道常量 / 快捷键注册表 / 错误码 / 语言列表
```

## 架构

三进程 Electron + 多渲染入口：

```
Renderer (React)  →  Preload (contextBridge)  →  Main (Node.js)  →  AI SDK / SQLite / 原生扩展
     ↑                                                                      |
     └────────────── IPC 事件流（流式 chunk / reasoning / end / error） ◄─────┘
```

- **主进程**：AI SDK 调用（保护 API Key 不暴露）、SQLite、窗口/托盘/全局快捷键、`selection-hook`、`node-screenshots`
- **预加载脚本**：通过 `contextBridge.exposeInMainWorld` 暴露类型安全的 IPC 接口（`window.api.*`），不暴露 `ipcRenderer`
- **渲染进程**：单 bundle，通过 URL `?mode=` 切换 5 个独立 App（主窗口 / Quick Assistant / Screenshot / Selection Toolbar / Selection Bubble）
- **IPC 响应**：请求-响应类统一使用 `IpcResult<T>`（`{ success, data?, error? }`），流式响应通过事件推送（`*:chunk` / `*:reasoning-chunk` / `*:end` / `*:error`），中止用 `AbortController` + `*:stop` 通道

## 推荐 IDE 配置

[VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
