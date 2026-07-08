# 所见即所得 Markdown 编辑器 — 设计文档

- 日期：2026-07-08
- 状态：待审阅
- 目标：在 AI Studio 中新增一个与「聊天 / 翻译 / 助手库」同级的顶层页面，提供类 Typora 的所见即所得 Markdown 编辑器，用于编辑本地 `.md` / `.markdown` 文件。

## 1. 背景与目标

用户需要一个像 Typora 一样的 WYSIWYG（所见即所得）Markdown 编辑器：在同一视图内直接渲染 Markdown（不是左右分栏源码 + 预览），支持打开单个文件、也支持打开文件夹作为工作区（带文件树）。

### 目标（本期范围）

- 新增顶层「编辑器」页面，入口与聊天/翻译同级。
- 打开单个 `.md` / `.markdown` 文件进行所见即所得编辑。
- 打开文件夹作为工作区，侧栏显示文件树，支持完整文件管理（浏览 + 新建 / 重命名 / 删除）。
- 干净集成 Milkdown（Crepe 成品编辑器）：表格、代码高亮、数学公式、图片、斜杠命令、浮动工具栏、拖拽块等其默认能力全部启用。
- 保存为标准 Markdown（与 Typora 兼容）。
- 尽量少打扰的自动保存策略。
- 监听文件在应用外部的改动，并按 VS Code / Typora 的规则处理。
- 新增「Markdown 编辑器」设置分区（首个可配置项：最大文件体积）。

### 非目标（本期不做）

- 不引入测试框架（后续手动测试；如需单测另行提案）。
- Mermaid 图表渲染为「可选增强」，第一版不阻塞、可放二期。
- 不实现多标签页 / 分屏 / 大纲导航（后续可议）。
- 不实现「未命名草稿」——本期所有编辑会话都对应磁盘上真实存在的文件。

## 2. 技术选型

### 结论：Milkdown Crepe（方案 A）

Milkdown v7 官方提供的成品编辑器 **Crepe**，定位即「inspired by Typora」——本质上是把「用 ProseMirror 拼一个 Typora」这件事做完并打包。底层链路：ProseMirror（编辑器内核）→ Milkdown（remark AST + 插件封装）→ Crepe（成品封装）。直接站在最高层。

被否决的方案：

- **方案 B（裸 ProseMirror / Milkdown core 自己挑插件）**：等于重新发明 Crepe（斜杠菜单、浮动工具栏、表格 UI、图片处理都要自己写），除非有 Crepe 满足不了的特殊需求，否则不值得。
- **方案 C（自研 contenteditable，Typora 的做法）**：`contenteditable` 在光标 / 选区 / 输入法（中文尤甚）/ 撤销重做上坑极多，等于把 ProseMirror 已解决的问题重踩一遍。不推荐。

### 许可证核实（商用无障碍）

逐个核实自 GitHub API + npm registry，整条依赖链均为 **MIT**：

| 包                                       | License | 版本       |
| ---------------------------------------- | ------- | ---------- |
| `@milkdown/crepe`                        | MIT     | 7.21.2     |
| `@milkdown/react`                        | MIT     | 7.21.2     |
| `@milkdown/kit`                          | MIT     | 7.21.2     |
| `@milkdown/core`                         | MIT     | 7.21.2     |
| `prosemirror-view` / `prosemirror-state` | MIT     | 1.42 / 1.4 |

底层 remark 及复用的 KaTeX / Shiki / Mermaid 亦为 MIT。MIT 允许免费商用、修改、分发、私用，无 copyleft、不要求公开自有源码；唯一义务是分发时保留第三方版权与许可证文本（`electron-builder` 打包携带第三方 license 清单即满足，属标准做法）。

### 新增依赖

- `@milkdown/crepe`
- `@milkdown/react`
- `@milkdown/kit`

（版本以 `7.21.2` 或安装时最新稳定版为准）

## 3. 架构总览

沿用现有 `activeView` 顶层视图切换模式，零架构改动。

```
┌─ PrimaryNav(既有) ─┬─ 文件侧栏 ──────┬─ Milkdown Crepe 编辑区 ─┐
│  聊天              │  [打开文件夹]    │                         │
│  翻译              │  [打开文件]      │   # 所见即所得           │
│  助手库            │  ▸ 文件树/最近   │   正文在这里直接渲染…     │
│ ▸编辑器(新)        │    列表          │                         │
│  设置              │  ─────────────  │                         │
│                    │  当前文件·状态点 │                         │
└────────────────────┴────────────────┴─────────────────────────┘
```

- 文件侧栏可折叠（复用 `AssistantSidebar` 的折叠模式 + `localStorage` 记忆键套路）。
- 侧栏顶部两个入口：打开文件（单文件）/ 打开文件夹（工作区，展示文件树）。
- 未打开任何文件时，编辑区显示欢迎 / 空状态。

### 数据流

```
选文件/文件夹 → editor-handlers 读磁盘 → 返回 UTF-8 文本
   → editorStore 记录 { currentPath, isDirty } → Crepe 载入 defaultValue
用户编辑 → Crepe markdownUpdated → 置 isDirty=true
Ctrl+S / 自动保存触发 → crepe.getMarkdown() → editor:save-file(path, md) → isDirty=false
```

## 4. 主进程 / IPC 设计

现有 `file:open-dialog` / `file:save` 是为聊天附件设计的（base64、10MB 上限、每次弹窗），不适合文本编辑器。新增独立的 `editor:*` IPC 域，遵循「一个域一个 handler 文件」约定。

### 新增文件

- `src/shared/ipc-channels.ts` — 在 `IpcChannels` 声明所有 `editor:*` 通道。
- `src/preload/index.ts` — 包装为 `window.api` 上的类型化方法。
- `src/main/ipc/editor-handlers.ts` — 新建，实现 handlers。

### IPC 通道

| 通道                        | 入参                   | 返回                        | 用途                                   |
| --------------------------- | ---------------------- | --------------------------- | -------------------------------------- |
| `editor:open-file-dialog`   | —                      | `{ path, content } \| null` | 弹窗选单个 `.md`/`.markdown`，读出文本 |
| `editor:open-folder-dialog` | —                      | `{ root, tree } \| null`    | 弹窗选文件夹，返回根路径 + 首层文件树  |
| `editor:read-file`          | `path`                 | `string`                    | 点文件树里的文件时读内容               |
| `editor:save-file`          | `path, content`        | `boolean`                   | 保存                                   |
| `editor:save-file-as`       | `content, defaultPath` | `path \| null`              | 另存为，返回新路径                     |
| `editor:list-dir`           | `path`                 | `TreeEntry[]`               | 展开文件树子目录（懒加载）             |
| `editor:create-file`        | `dirPath, name`        | `path`                      | 工作区内新建文件                       |
| `editor:rename`             | `oldPath, newName`     | `newPath`                   | 重命名文件 / 目录                      |
| `editor:delete`             | `path`                 | `boolean`                   | 删除到系统回收站（`shell.trashItem`）  |

事件推送（沿用 streaming 那套 event-push 模式）：

| 事件                  | 数据                                      | 用途                                                                                    |
| --------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------- |
| `editor:file-changed` | `{ path, type: 'modified' \| 'removed' }` | 主进程 `fs.watch` 检测到外部改动后（去抖）推送给渲染层；`removed` 覆盖外部删除 / 重命名 |

### 数据类型（`src/shared/types.ts` 新增）

```ts
export interface TreeEntry {
  name: string // 文件 / 目录名（非全路径）
  path: string // 绝对路径
  isDirectory: boolean
  children?: TreeEntry[] // 目录懒加载：未展开时省略，展开后由 editor:list-dir 填充
}
```

仅列出 `.md` / `.markdown` 文件与目录；其它文件类型不进树。

### editorStore（新增 Zustand store）

与现有 10 个 store 并列。持有：

- `currentPath: string \| null` — 当前打开文件的绝对路径
- `workspaceRoot: string \| null` — 打开的文件夹根路径（单文件模式为 null）
- `fileTree: TreeEntry[]` — 文件树
- `isDirty: boolean` — 是否有未保存改动
- `recentFiles / recentWorkspaces` — 最近打开列表

### 持久化

最近打开的文件与文件夹持久化到 `settings` 表（如 `editor.recentFiles` / `editor.lastWorkspace`），沿用现成 settings IPC，**不改 DB schema**。重启后可快速恢复。

### 安全边界

- 打开文件夹后，所有读写路径必须落在 `workspaceRoot` 之内——复用 `attachments.ts` 中 `resolve + startsWith(baseDir + sep)` 的成熟越界校验写法。
- 单文件模式以用户 dialog 显式选中的路径为准。
- 仅允许 `.md` / `.markdown` 扩展名；非文本文件不在范围内。
- 文件体积上限默认 2 MB（可在设置中改写，见 §7）；超限时拒绝打开并给本地化提示，不崩溃。

## 5. 编辑器集成（Milkdown Crepe）

### 组件结构（新目录 `src/renderer/src/components/editor/`）

```
editor/
├── EditorView.tsx        # 顶层：左侧文件栏 + 右侧编辑区（AppLayout 懒加载它）
├── FileSidebar.tsx       # 打开文件/文件夹按钮、文件树、最近列表、右键菜单(增删改)
├── FileTree.tsx          # 递归文件树节点（懒加载子目录）
├── CrepeEditor.tsx       # 封装 MilkdownProvider + Crepe 实例
├── EditorToolbar.tsx     # 顶部：文件名、保存状态圆点、另存为等
└── WelcomeState.tsx      # 未打开文件时的空状态
```

### Crepe 配置

- 启用默认功能：`Toolbar`（选中浮动工具栏）、`CodeMirror`（代码块高亮）、`ListItem`、`LinkTooltip`、`ImageBlock`、`BlockEdit`（斜杠菜单 + 拖拽块）、`Table`、`Cursor`、`Placeholder`、`Latex`（数学公式）。
- **代码高亮对接 Shiki**：官方 `@milkdown/plugin-highlight/shiki` 直接吃 Shiki，与项目 `lib/shiki.ts` 同引擎，主题可与现有代码块统一。
- **载入 / 取值**：打开文件时用返回文本作 `defaultValue` 重建编辑器；保存时 `crepe.getMarkdown()` 取回标准 Markdown。
- **脏标记**：`crepe.on(listener.markdownUpdated(...))` → `editorStore.setDirty(true)`。
- **主题联动**：接入 `@milkdown/crepe/theme` 的 CSS，跟随现有 `ThemeProvider` 写在 `<html>` 的明暗变量与 6 套主题的明暗模式。

### Mermaid（可选增强，二期）

Crepe 默认不含。二期可挂 `@milkdown/plugin-diagram` 或复用现有 `MermaidBlock` 做自定义节点渲染。第一版不阻塞。

### 快捷键

- `Ctrl+S` 保存 **仅在编辑器视图内本地拦截**，不纳入全局 `DEFAULT_KEYBINDINGS` 注册表。
- Crepe 自带 Markdown 输入语法与撤销 / 重做。

## 6. 保存与外部改动策略

### 自动保存（尽量少打扰）

应用**内部**的一切场景——切换文件、切到别的主视图、关闭应用——只要 `isDirty` 为真，**直接静默自动保存**，不弹窗。前提是本期所有编辑会话都对应磁盘真实文件，故自动保存永远有明确目标路径。

### 外部改动（对齐 VS Code / Typora）

主进程用 `fs.watch` 监听当前文件（工作区模式下监听工作区），去抖后经 `editor:file-changed` 推送。渲染层规则：

- **无未保存改动（`isDirty === false`）→ 静默自动重载**，无感刷新。
- **有未保存改动 → 不自动覆盖**，弹窗提示「磁盘上的文件已变化：保留我的版本 / 放弃并重载」，由用户手动确认。

这是本设计中**唯一**需要用户手动确认的弹窗。

> 实现注意：自动保存写盘本身会触发 `fs.watch`。需抑制「自我触发」的 watch 事件（例如写盘时打时间戳 / 忽略窗口），避免自动保存被误判为外部改动而弹窗。

### 边界情况

- **外部删除当前文件**（`fs.watch` 报删除）→ 仅提示「文件不存在」，不做多余动作。
- **外部重命名 / 删除当前文件** → 行为与「文件已不存在」完全一致（路径消失，走同一套提示）。
- **打开超大文件**（超过配置上限）→ 拒绝并给本地化错误，不崩编辑器。
- **工作区内路径越界 / 无权限** → 抛 `AppError`，包成 `IpcResult<T>`。
- **`fs.watch` 在 Windows 上重复 / 抖动事件** → 去抖（复用 `window-size-persist.ts` 的 debounce 思路）。
- **应用内重命名 / 删除当前正在编辑的文件** → 同步更新 `editorStore.currentPath`。

## 7. 设置分区

新增「Markdown 编辑器」设置分区，遵循现有设置页模式：

- `src/renderer/src/components/settings/SettingsSidebar.tsx` — `SettingsSection` 联合类型加 `'markdown-editor'`；`sectionGroups` 加一项（图标如 Lucide `FileText`）。
- `src/renderer/src/components/settings/SettingsPage.tsx` — 加渲染分支 `activeSection === 'markdown-editor' && <MarkdownEditorSection />`。
- `src/renderer/src/App.tsx` — `TRAY_SETTINGS_SECTIONS` 补 `'markdown-editor'`。
- 新增 `MarkdownEditorSection.tsx`。

首个可配置项：

- **最大文件体积**（默认 2 MB）——超过则拒绝在编辑器打开，仅提示不崩溃。持久化到 `settings` 表（如 `editor.maxFileSizeMb`）。

## 8. 国际化

两个 locale 文件（`en` / `zh-CN`）新增 `editor.*` 命名空间：

- `nav.editor`（导航项文案）
- 按钮：打开文件 / 打开文件夹 / 保存 / 另存为 / 新建 / 重命名 / 删除
- 空状态文案
- 外部改动确认弹窗文案（保留我的 / 放弃并重载）
- 错误提示
- 设置分区文案（`settings.sections.markdownEditor` 等）

错误走现有 `LocalizedError` + `ERROR_CODES`，新增如 `EDITOR_FILE_TOO_LARGE` / `EDITOR_READ_FAILED` / `EDITOR_PATH_OUTSIDE_WORKSPACE` / `EDITOR_FILE_NOT_FOUND`。

## 9. 改动点清单

### 新增文件

- `src/main/ipc/editor-handlers.ts`
- `src/renderer/src/stores/editorStore.ts`
- `src/renderer/src/components/editor/{EditorView,FileSidebar,FileTree,CrepeEditor,EditorToolbar,WelcomeState}.tsx`
- `src/renderer/src/components/editor/index.ts`（聚合导出）
- `src/renderer/src/components/settings/MarkdownEditorSection.tsx`

### 修改文件

- `src/shared/ipc-channels.ts` — 声明 `editor:*` 通道
- `src/shared/types.ts` — `TreeEntry` 等新类型
- `src/shared/errors.ts` — 新增 `EDITOR_*` 错误码
- `src/preload/index.ts` — 包装 `editor:*` 方法
- `src/main/ipc/index.ts` — 注册 `registerEditorHandlers`
- `src/renderer/src/stores/settingsStore.ts` — `ActiveView` 加 `'editor'`
- `src/renderer/src/components/layout/PrimaryNav.tsx` — 加导航图标
- `src/renderer/src/components/layout/AppLayout.tsx` — 加 `editor` 懒加载分支
- `src/renderer/src/components/settings/SettingsSidebar.tsx` — 加设置分区
- `src/renderer/src/components/settings/SettingsPage.tsx` — 加渲染分支
- `src/renderer/src/App.tsx` — `TRAY_SETTINGS_SECTIONS` 补项
- `src/renderer/src/i18n/locales/{en,zh-CN}.json` — 新增文案
- `package.json` — 新增 3 个 Milkdown 依赖

## 10. 验证策略

项目当前无测试框架，与现有工程实践一致，本功能以类型检查 + 构建 + 手动冒烟为准（本期不引入测试框架）。

- `npm run typecheck`（node + web 双 tsconfig）必须干净——`npm run build` 会先跑它，是发版硬门槛。
- `npm run lint` + `npm run format`（改动后按约定跑 Prettier）。
- 手动冒烟清单：
  1. 打开单文件 → 编辑 → 保存 → 重开确认落盘。
  2. 打开文件夹 → 树浏览 → 新建 / 重命名 / 删除（进回收站）。
  3. 切换文件 / 切主视图 / 关应用时有未保存改动 → 静默自动保存，不弹窗。
  4. 外部改文件：无脏时自动重载；有脏时弹「保留我的 / 放弃重载」确认。
  5. 外部删除 / 重命名当前文件 → 提示「文件不存在」。
  6. 打开超过配置上限的文件 → 拒绝 + 提示，不崩溃。
  7. 设置分区修改最大体积 → 生效。
  8. 明暗主题切换，编辑器样式跟随。
  9. 表格 / 代码高亮 / 公式在编辑器内实时渲染。
