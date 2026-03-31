# AI Studio

基于 Electron + React 构建的桌面端 AI 对话应用。支持多服务商接入、流式响应、助手系统、翻译功能、本地持久化存储，提供流畅的原生桌面体验。

![Electron](https://img.shields.io/badge/Electron-39-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-WAL-003B57?logo=sqlite&logoColor=white)

## 功能特性

### 💬 AI 对话

- **多服务商支持** — OpenAI / Azure OpenAI / Anthropic / DeepSeek / SiliconFlow / NewAPI / 自定义兼容接口
- **流式响应** — 实时逐字输出，支持随时停止生成
- **自动标题** — AI 自动为会话生成简洁标题
- **扩展思维** — 支持 Reasoning Level 调节（Low / Medium / High / XHigh）
- **文件附件** — 支持图片（jpg/png/gif/webp）、文本（txt/md/csv/json）、PDF，单文件最大 10MB，图片内联预览

### 🤖 助手系统

- 创建多个命名助手，各自独立绑定服务商、模型和系统提示词
- 可配置生成参数：Temperature、Top P、Max Completion Tokens、Context Count
- 支持提示词建议（Prompt Suggestions）
- 助手置顶、分组、复制

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
- API 连接测试

### ⌨️ 键盘快捷键

| 快捷键   | 功能          |
| -------- | ------------- |
| `Ctrl+N` | 新建会话      |
| `Ctrl+,` | 打开/关闭设置 |
| `Escape` | 停止生成      |

## 技术栈

| 类别     | 技术                                         |
| -------- | -------------------------------------------- |
| 运行时   | Electron 39 + React 19                       |
| 语言     | TypeScript（strict mode）                    |
| 构建     | electron-vite（Vite）                        |
| UI 框架  | Shadcn/UI (Radix UI) + Tailwind CSS v4 + Lucide Icons |
| 状态管理 | Zustand 5                                    |
| 数据库   | better-sqlite3（WAL 模式）                   |
| AI SDK   | openai（兼容 OpenAI / Azure / Anthropic / DeepSeek 等多服务商） |
| Markdown | react-markdown + remark-gfm + Shiki 语法高亮 |
| 国际化   | i18next + react-i18next                      |
| 包管理   | npm                                          |

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
npm run lint        # ESLint 检查
npm run format      # Prettier 格式化
npm run typecheck   # TypeScript 类型检查
```

## 项目结构

```
src/
├── main/                  # 主进程（Node.js）
│   ├── ai/                #   AI 客户端工厂（OpenAI / Azure）
│   ├── db/                #   SQLite 数据库操作
│   └── ipc/               #   IPC 处理器（按领域拆分）
├── preload/               # 预加载脚本（contextBridge 安全桥接）
├── renderer/src/          # 渲染进程（React）
│   ├── components/        #   UI 组件（chat / layout / settings / translate / theme）
│   ├── stores/            #   Zustand 状态管理
│   ├── hooks/             #   自定义 Hooks
│   ├── i18n/              #   国际化资源
│   └── lib/               #   工具函数（Shiki、utils）
└── shared/                # 共享类型定义与 IPC 通道常量
```

## 架构

三进程 Electron 架构：

```
Renderer (React)  →  Preload (contextBridge)  →  Main (Node.js)  →  AI API / SQLite
     ↑                                                                      |
     └──────────────────── IPC 事件流（流式响应） ◄─────────────────────────┘
```

- **主进程**：AI API 调用（保护 API Key 不暴露）、SQLite 数据库操作、窗口管理
- **预加载脚本**：通过 `contextBridge.exposeInMainWorld` 暴露类型安全的 IPC 接口
- **渲染进程**：React UI，所有与主进程的通信通过 `window.api.*` 进行
- **IPC 响应**：统一使用 `IpcResult<T>` 包装（`{ success, data?, error? }`），流式数据通过事件推送

## 推荐 IDE 配置

[VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
