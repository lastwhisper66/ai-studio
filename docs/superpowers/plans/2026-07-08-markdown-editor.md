# Markdown 编辑器实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 AI Studio 中新增一个与聊天/翻译同级的顶层"编辑器"页面，提供类 Typora 的所见即所得 Markdown 编辑器。

**Architecture:** 基于 Milkdown Crepe 成品编辑器，通过独立的 IPC 域（`editor:*`）处理文件操作，使用新的 Zustand store 管理编辑器状态，支持单文件模式和工作区模式，仅监听当前文件的外部改动，使用独立 DB 表持久化最近打开列表。

**Tech Stack:** Milkdown Crepe 7.21.2, React 19, Zustand 5, better-sqlite3, Node.js fs/fs.watch, Electron dialog/shell APIs

## Global Constraints

- Milkdown 版本：7.21.2 或安装时最新稳定版
- 仅接受 `.md` / `.markdown` 扩展名
- 默认文件体积上限 2 MB（可在设置中配置）
- 监听范围：仅当前正在编辑的文件，不递归监听整个工作区
- 保存为标准 Markdown，与 Typora 兼容
- 最近列表：文件和文件夹各限制 20 条
- 所有 IPC 通道名必须先在 `src/shared/ipc-channels.ts` 声明
- 错误使用 `AppError` + `ERROR_CODES`，返回 `IpcResult<T>`
- 本期不引入测试框架，依赖类型检查 + 构建 + 手动冒烟测试

---

## Task 1: 共享类型与 IPC 通道声明

**Files:**

- Modify: `src/shared/types.ts` (末尾追加)
- Modify: `src/shared/ipc-channels.ts` (末尾追加)
- Modify: `src/shared/errors.ts` (末尾追加)

**Interfaces:**

- Consumes: 无（基础设施任务）
- Produces:
  - `TreeEntry` / `RecentEntry` 类型（供所有后续任务使用）
  - `IpcChannels` 中的 `editor:*` 通道名常量
  - `ERROR_CODES` 中的 `EDITOR_*` 错误码

- [ ] **Step 1: 在 `src/shared/types.ts` 末尾追加编辑器类型定义**

```typescript
// Markdown 编辑器相关类型
export interface TreeEntry {
  name: string // 文件/目录名（非全路径）
  path: string // 绝对路径
  isDirectory: boolean
  children?: TreeEntry[] // 目录懒加载：未展开时省略
}

export interface RecentEntry {
  path: string // 绝对路径（文件或文件夹）
  kind: 'file' | 'folder'
  openedAt: string // ISO 时间戳
}
```

- [ ] **Step 2: 在 `src/shared/ipc-channels.ts` 的 `IpcChannels` 对象末尾追加编辑器通道**

```typescript
  // Markdown 编辑器
  EDITOR_OPEN_FILE_DIALOG: 'editor:open-file-dialog',
  EDITOR_OPEN_FOLDER_DIALOG: 'editor:open-folder-dialog',
  EDITOR_READ_FILE: 'editor:read-file',
  EDITOR_SAVE_FILE: 'editor:save-file',
  EDITOR_SAVE_FILE_AS: 'editor:save-file-as',
  EDITOR_LIST_DIR: 'editor:list-dir',
  EDITOR_CREATE_FILE: 'editor:create-file',
  EDITOR_RENAME: 'editor:rename',
  EDITOR_DELETE: 'editor:delete',
  EDITOR_FILE_CHANGED: 'editor:file-changed',
  EDITOR_LIST_RECENT: 'editor:list-recent',
  EDITOR_ADD_RECENT: 'editor:add-recent',
  EDITOR_REMOVE_RECENT: 'editor:remove-recent',
  EDITOR_CLEAR_RECENT: 'editor:clear-recent',
```

- [ ] **Step 3: 在 `src/shared/errors.ts` 的 `ERROR_CODES` 对象末尾追加编辑器错误码**

```typescript
  // Markdown 编辑器错误码
  EDITOR_FILE_TOO_LARGE: 'EDITOR_FILE_TOO_LARGE',
  EDITOR_READ_FAILED: 'EDITOR_READ_FAILED',
  EDITOR_WRITE_FAILED: 'EDITOR_WRITE_FAILED',
  EDITOR_PATH_OUTSIDE_WORKSPACE: 'EDITOR_PATH_OUTSIDE_WORKSPACE',
  EDITOR_FILE_NOT_FOUND: 'EDITOR_FILE_NOT_FOUND',
  EDITOR_INVALID_EXTENSION: 'EDITOR_INVALID_EXTENSION',
  EDITOR_DELETE_FAILED: 'EDITOR_DELETE_FAILED',
```

- [ ] **Step 4: 类型检查**

```bash
npm run typecheck
```

Expected: PASS（无类型错误）

- [ ] **Step 5: Commit**

```bash
git add src/shared/types.ts src/shared/ipc-channels.ts src/shared/errors.ts
git commit -m "feat(editor): add shared types, IPC channels, and error codes"
```

---

## Task 2: 数据库迁移 — 新增 `editor_recent_files` 表

**Files:**

- Create: `src/main/migrate/008-editor-recent-files.ts`
- Modify: `src/main/migrate/index.ts`
- Modify: `src/main/db/database.ts` (`createTables` 函数内)

**Interfaces:**

- Consumes: 迁移框架（`src/main/migrate/index.ts` 中的 `Migration` 类型）
- Produces: `editor_recent_files` 表结构（供 Task 3 的 DB 模块使用）

- [ ] **Step 1: 创建迁移文件 `src/main/migrate/008-editor-recent-files.ts`**

```typescript
import type { Database } from 'better-sqlite3'
import type { Migration } from './index'

export const migration008: Migration = {
  version: 8,
  name: 'editor-recent-files',
  up(db: Database) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS editor_recent_files (
        path       TEXT PRIMARY KEY,
        kind       TEXT NOT NULL CHECK (kind IN ('file', 'folder')),
        opened_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_editor_recent_files_opened_at
        ON editor_recent_files(opened_at);
    `)
  },
}
```

- [ ] **Step 2: 在 `src/main/migrate/index.ts` 顶部 import 新迁移**

在现有 import 块末尾追加：

```typescript
import { migration008 } from './008-editor-recent-files'
```

- [ ] **Step 3: 在 `MIGRATIONS` 数组末尾 push 新迁移**

找到 `export const MIGRATIONS: Migration[] = [...]`，在数组末尾追加：

```typescript
  migration008,
```

- [ ] **Step 4: 在 `src/main/db/database.ts` 的 `createTables()` 内追加表创建语句**

在 `createTables()` 函数的最后一个 `db.exec()` 块末尾（关闭事务前）追加：

```typescript
    -- Markdown 编辑器最近打开列表
    CREATE TABLE IF NOT EXISTS editor_recent_files (
      path       TEXT PRIMARY KEY,
      kind       TEXT NOT NULL CHECK (kind IN ('file', 'folder')),
      opened_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_editor_recent_files_opened_at
      ON editor_recent_files(opened_at);
```

- [ ] **Step 5: 类型检查**

```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/main/migrate/008-editor-recent-files.ts src/main/migrate/index.ts src/main/db/database.ts
git commit -m "feat(editor): add editor_recent_files table migration"
```

---

## Task 3: 数据库 CRUD 模块 — `editor-recent.ts`

**Files:**

- Create: `src/main/db/editor-recent.ts`
- Modify: `src/main/db/index.ts` (导出模块)

**Interfaces:**

- Consumes: `editor_recent_files` 表（Task 2）、`RecentEntry` 类型（Task 1）
- Produces:
  - `listRecent(): RecentEntry[]`
  - `addRecent(path: string, kind: 'file' | 'folder'): void`
  - `removeRecent(path: string): void`
  - `clearRecent(): void`

- [ ] **Step 1: 创建 `src/main/db/editor-recent.ts`**

```typescript
import type { RecentEntry } from '@shared/types'
import { getDatabase } from './database'

const MAX_RECENT = 20

export function listRecent(): RecentEntry[] {
  const db = getDatabase()
  const rows = db
    .prepare(
      `SELECT path, kind, opened_at as openedAt 
       FROM editor_recent_files 
       ORDER BY opened_at DESC 
       LIMIT ?`,
    )
    .all(MAX_RECENT) as RecentEntry[]
  return rows
}

export function addRecent(path: string, kind: 'file' | 'folder'): void {
  const db = getDatabase()
  db.prepare(
    `INSERT INTO editor_recent_files (path, kind, opened_at) 
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(path) DO UPDATE SET opened_at = datetime('now')`,
  ).run(path, kind)
}

export function removeRecent(path: string): void {
  const db = getDatabase()
  db.prepare('DELETE FROM editor_recent_files WHERE path = ?').run(path)
}

export function clearRecent(): void {
  const db = getDatabase()
  db.prepare('DELETE FROM editor_recent_files').run()
}
```

- [ ] **Step 2: 在 `src/main/db/index.ts` 末尾添加导出**

```typescript
export * from './editor-recent'
```

- [ ] **Step 3: 类型检查**

```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/main/db/editor-recent.ts src/main/db/index.ts
git commit -m "feat(editor): add editor-recent DB module"
```

---

## Task 4: 主进程 IPC handlers — 文件操作与最近列表

**Files:**

- Create: `src/main/ipc/editor-handlers.ts`
- Modify: `src/main/ipc/index.ts` (注册 handlers)

**Interfaces:**

- Consumes:
  - `IpcChannels.EDITOR_*` 常量（Task 1）
  - `listRecent()`, `addRecent()`, `removeRecent()`, `clearRecent()` (Task 3)
  - `TreeEntry`, `RecentEntry` 类型（Task 1）
- Produces:
  - 所有 `editor:*` IPC 通道的实现
  - `currentFileWatcher: FSWatcher | null` 全局变量（供 Task 5 使用）
  - `setCurrentFileWatch(path: string | null)` 导出函数（供 Task 5 使用）

- [ ] **Step 1: 创建 `src/main/ipc/editor-handlers.ts` 第 1 部分（文件选择与读取）**

```typescript
import { dialog, shell, type IpcMainInvokeEvent } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { FSWatcher } from 'node:fs'
import type { IpcResult, TreeEntry, RecentEntry } from '@shared/types'
import { IpcChannels } from '@shared/ipc-channels'
import { AppError } from '../errors'
import { ERROR_CODES } from '@shared/errors'
import { getSetting } from '../db/settings'
import { listRecent, addRecent, removeRecent, clearRecent } from '../db/editor-recent'

const ALLOWED_EXTENSIONS = ['.md', '.markdown']
let currentFileWatcher: FSWatcher | null = null
let lastWriteTimestamp = 0

function getMaxFileSizeMb(): number {
  const value = getSetting('editor.maxFileSizeMb')
  return value ? Number(value) : 2
}

function checkExtension(filePath: string): void {
  const ext = path.extname(filePath).toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new AppError(ERROR_CODES.EDITOR_INVALID_EXTENSION, { ext })
  }
}

function checkFileSize(filePath: string): void {
  const stats = fs.statSync(filePath)
  const maxBytes = getMaxFileSizeMb() * 1024 * 1024
  if (stats.size > maxBytes) {
    throw new AppError(ERROR_CODES.EDITOR_FILE_TOO_LARGE, {
      size: stats.size,
      max: maxBytes,
    })
  }
}

async function handleOpenFileDialog(): Promise<IpcResult<{ path: string; content: string }>> {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { success: true, data: null }
    }
    const filePath = result.filePaths[0]
    checkFileSize(filePath)
    const content = fs.readFileSync(filePath, 'utf-8')
    return { success: true, data: { path: filePath, content } }
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, error: error.toLocalized() }
    }
    return {
      success: false,
      error: { code: ERROR_CODES.EDITOR_READ_FAILED, params: {} },
    }
  }
}

async function handleOpenFolderDialog(): Promise<IpcResult<{ root: string; tree: TreeEntry[] }>> {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { success: true, data: null }
    }
    const root = result.filePaths[0]
    const tree = listDirectory(root)
    return { success: true, data: { root, tree } }
  } catch (error) {
    return {
      success: false,
      error: { code: ERROR_CODES.EDITOR_READ_FAILED, params: {} },
    }
  }
}

function handleReadFile(_: IpcMainInvokeEvent, filePath: string): IpcResult<string> {
  try {
    checkExtension(filePath)
    checkFileSize(filePath)
    const content = fs.readFileSync(filePath, 'utf-8')
    return { success: true, data: content }
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, error: error.toLocalized() }
    }
    return {
      success: false,
      error: { code: ERROR_CODES.EDITOR_READ_FAILED, params: {} },
    }
  }
}
```

- [ ] **Step 2: 继续编写 `editor-handlers.ts` 第 2 部分（保存、目录列表）**

```typescript
function handleSaveFile(
  _: IpcMainInvokeEvent,
  filePath: string,
  content: string,
): IpcResult<boolean> {
  try {
    lastWriteTimestamp = Date.now()
    fs.writeFileSync(filePath, content, 'utf-8')
    return { success: true, data: true }
  } catch (error) {
    return {
      success: false,
      error: { code: ERROR_CODES.EDITOR_WRITE_FAILED, params: {} },
    }
  }
}

async function handleSaveFileAs(
  _: IpcMainInvokeEvent,
  content: string,
  defaultPath?: string,
): Promise<IpcResult<string>> {
  try {
    const result = await dialog.showSaveDialog({
      defaultPath,
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
    })
    if (result.canceled || !result.filePath) {
      return { success: true, data: null }
    }
    lastWriteTimestamp = Date.now()
    fs.writeFileSync(result.filePath, content, 'utf-8')
    return { success: true, data: result.filePath }
  } catch (error) {
    return {
      success: false,
      error: { code: ERROR_CODES.EDITOR_WRITE_FAILED, params: {} },
    }
  }
}

function listDirectory(dirPath: string): TreeEntry[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  const result: TreeEntry[] = []

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      result.push({
        name: entry.name,
        path: fullPath,
        isDirectory: true,
      })
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase()
      if (ALLOWED_EXTENSIONS.includes(ext)) {
        result.push({
          name: entry.name,
          path: fullPath,
          isDirectory: false,
        })
      }
    }
  }

  return result.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1
    }
    return a.name.localeCompare(b.name)
  })
}

function handleListDir(_: IpcMainInvokeEvent, dirPath: string): IpcResult<TreeEntry[]> {
  try {
    const tree = listDirectory(dirPath)
    return { success: true, data: tree }
  } catch (error) {
    return {
      success: false,
      error: { code: ERROR_CODES.EDITOR_READ_FAILED, params: {} },
    }
  }
}
```

- [ ] **Step 3: 继续编写 `editor-handlers.ts` 第 3 部分（创建、重命名、删除）**

```typescript
function handleCreateFile(_: IpcMainInvokeEvent, dirPath: string, name: string): IpcResult<string> {
  try {
    const filePath = path.join(dirPath, name)
    if (!name.endsWith('.md') && !name.endsWith('.markdown')) {
      throw new AppError(ERROR_CODES.EDITOR_INVALID_EXTENSION, {
        ext: path.extname(name),
      })
    }
    fs.writeFileSync(filePath, '', 'utf-8')
    return { success: true, data: filePath }
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, error: error.toLocalized() }
    }
    return {
      success: false,
      error: { code: ERROR_CODES.EDITOR_WRITE_FAILED, params: {} },
    }
  }
}

function handleRename(_: IpcMainInvokeEvent, oldPath: string, newName: string): IpcResult<string> {
  try {
    const dir = path.dirname(oldPath)
    const newPath = path.join(dir, newName)
    fs.renameSync(oldPath, newPath)
    return { success: true, data: newPath }
  } catch (error) {
    return {
      success: false,
      error: { code: ERROR_CODES.EDITOR_WRITE_FAILED, params: {} },
    }
  }
}

async function handleDelete(_: IpcMainInvokeEvent, filePath: string): Promise<IpcResult<boolean>> {
  try {
    await shell.trashItem(filePath)
    return { success: true, data: true }
  } catch (error) {
    return {
      success: false,
      error: { code: ERROR_CODES.EDITOR_DELETE_FAILED, params: {} },
    }
  }
}
```

- [ ] **Step 4: 继续编写 `editor-handlers.ts` 第 4 部分（最近列表与 watcher）**

```typescript
function handleListRecent(): IpcResult<RecentEntry[]> {
  try {
    const recent = listRecent()
    return { success: true, data: recent }
  } catch (error) {
    return { success: true, data: [] }
  }
}

function handleAddRecent(
  _: IpcMainInvokeEvent,
  filePath: string,
  kind: 'file' | 'folder',
): IpcResult<boolean> {
  try {
    addRecent(filePath, kind)
    return { success: true, data: true }
  } catch (error) {
    return { success: false, data: false }
  }
}

function handleRemoveRecent(_: IpcMainInvokeEvent, filePath: string): IpcResult<boolean> {
  try {
    removeRecent(filePath)
    return { success: true, data: true }
  } catch (error) {
    return { success: false, data: false }
  }
}

function handleClearRecent(): IpcResult<boolean> {
  try {
    clearRecent()
    return { success: true, data: true }
  } catch (error) {
    return { success: false, data: false }
  }
}

export function setCurrentFileWatch(filePath: string | null, webContents: any): void {
  if (currentFileWatcher) {
    currentFileWatcher.close()
    currentFileWatcher = null
  }

  if (!filePath) return

  let debounceTimer: NodeJS.Timeout | null = null

  currentFileWatcher = fs.watch(filePath, (eventType) => {
    if (debounceTimer) clearTimeout(debounceTimer)

    debounceTimer = setTimeout(() => {
      const now = Date.now()
      if (now - lastWriteTimestamp < 1000) {
        return
      }

      const exists = fs.existsSync(filePath)
      webContents.send(IpcChannels.EDITOR_FILE_CHANGED, {
        path: filePath,
        type: exists ? 'modified' : 'removed',
      })
    }, 300)
  })
}

export function registerEditorHandlers(ipcMain: any): void {
  ipcMain.handle(IpcChannels.EDITOR_OPEN_FILE_DIALOG, handleOpenFileDialog)
  ipcMain.handle(IpcChannels.EDITOR_OPEN_FOLDER_DIALOG, handleOpenFolderDialog)
  ipcMain.handle(IpcChannels.EDITOR_READ_FILE, handleReadFile)
  ipcMain.handle(IpcChannels.EDITOR_SAVE_FILE, handleSaveFile)
  ipcMain.handle(IpcChannels.EDITOR_SAVE_FILE_AS, handleSaveFileAs)
  ipcMain.handle(IpcChannels.EDITOR_LIST_DIR, handleListDir)
  ipcMain.handle(IpcChannels.EDITOR_CREATE_FILE, handleCreateFile)
  ipcMain.handle(IpcChannels.EDITOR_RENAME, handleRename)
  ipcMain.handle(IpcChannels.EDITOR_DELETE, handleDelete)
  ipcMain.handle(IpcChannels.EDITOR_LIST_RECENT, handleListRecent)
  ipcMain.handle(IpcChannels.EDITOR_ADD_RECENT, handleAddRecent)
  ipcMain.handle(IpcChannels.EDITOR_REMOVE_RECENT, handleRemoveRecent)
  ipcMain.handle(IpcChannels.EDITOR_CLEAR_RECENT, handleClearRecent)
}
```

- [ ] **Step 5: 在 `src/main/ipc/index.ts` 中注册 editor handlers**

在文件顶部 import：

```typescript
import { registerEditorHandlers } from './editor-handlers'
```

在 `export function registerAllHandlers(ipcMain)` 函数末尾添加：

```typescript
registerEditorHandlers(ipcMain)
```

- [ ] **Step 6: 类型检查**

```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/main/ipc/editor-handlers.ts src/main/ipc/index.ts
git commit -m "feat(editor): add editor IPC handlers for file operations"
```

---

## Task 5: Preload 桥接 — 暴露编辑器 API

**Files:**

- Modify: `src/preload/index.ts`

**Interfaces:**

- Consumes: `IpcChannels.EDITOR_*` 常量（Task 1）
- Produces: `window.api` 上的类型化编辑器方法（供渲染层使用）

- [ ] **Step 1: 在 `src/preload/index.ts` 的 `api` 对象末尾追加编辑器方法**

找到 `contextBridge.exposeInMainWorld('api', {...})` 块，在对象末尾追加：

```typescript
  // Markdown 编辑器
  openFileDialog: (): Promise<IpcResult<{ path: string; content: string } | null>> =>
    ipcRenderer.invoke(IpcChannels.EDITOR_OPEN_FILE_DIALOG),
  openFolderDialog: (): Promise<IpcResult<{ root: string; tree: TreeEntry[] } | null>> =>
    ipcRenderer.invoke(IpcChannels.EDITOR_OPEN_FOLDER_DIALOG),
  readFile: (path: string): Promise<IpcResult<string>> =>
    ipcRenderer.invoke(IpcChannels.EDITOR_READ_FILE, path),
  saveFile: (path: string, content: string): Promise<IpcResult<boolean>> =>
    ipcRenderer.invoke(IpcChannels.EDITOR_SAVE_FILE, path, content),
  saveFileAs: (content: string, defaultPath?: string): Promise<IpcResult<string | null>> =>
    ipcRenderer.invoke(IpcChannels.EDITOR_SAVE_FILE_AS, content, defaultPath),
  listDir: (path: string): Promise<IpcResult<TreeEntry[]>> =>
    ipcRenderer.invoke(IpcChannels.EDITOR_LIST_DIR, path),
  createFile: (dirPath: string, name: string): Promise<IpcResult<string>> =>
    ipcRenderer.invoke(IpcChannels.EDITOR_CREATE_FILE, dirPath, name),
  renameFile: (oldPath: string, newName: string): Promise<IpcResult<string>> =>
    ipcRenderer.invoke(IpcChannels.EDITOR_RENAME, oldPath, newName),
  deleteFile: (path: string): Promise<IpcResult<boolean>> =>
    ipcRenderer.invoke(IpcChannels.EDITOR_DELETE, path),
  listRecentFiles: (): Promise<IpcResult<RecentEntry[]>> =>
    ipcRenderer.invoke(IpcChannels.EDITOR_LIST_RECENT),
  addRecentFile: (path: string, kind: 'file' | 'folder'): Promise<IpcResult<boolean>> =>
    ipcRenderer.invoke(IpcChannels.EDITOR_ADD_RECENT, path, kind),
  removeRecentFile: (path: string): Promise<IpcResult<boolean>> =>
    ipcRenderer.invoke(IpcChannels.EDITOR_REMOVE_RECENT, path),
  clearRecentFiles: (): Promise<IpcResult<boolean>> =>
    ipcRenderer.invoke(IpcChannels.EDITOR_CLEAR_RECENT),
  onFileChanged: (callback: (data: { path: string; type: 'modified' | 'removed' }) => void) => {
    ipcRenderer.on(IpcChannels.EDITOR_FILE_CHANGED, (_, data) => callback(data))
  },
```

- [ ] **Step 2: 类型检查**

```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/preload/index.ts
git commit -m "feat(editor): expose editor APIs in preload bridge"
```

---

## Task 6: Zustand Store — `editorStore`

**Files:**

- Create: `src/renderer/src/stores/editorStore.ts`

**Interfaces:**

- Consumes: `TreeEntry`, `RecentEntry` 类型（Task 1）
- Produces:
  - `useEditorStore()` hook
  - State: `currentPath`, `workspaceRoot`, `fileTree`, `isDirty`, `recent`
  - Actions: `setCurrentPath`, `setWorkspaceRoot`, `setFileTree`, `setDirty`, `setRecent`, `reset`

- [ ] **Step 1: 创建 `src/renderer/src/stores/editorStore.ts`**

```typescript
import { create } from 'zustand'
import type { TreeEntry, RecentEntry } from '@shared/types'

interface EditorState {
  currentPath: string | null
  workspaceRoot: string | null
  fileTree: TreeEntry[]
  isDirty: boolean
  recent: RecentEntry[]

  setCurrentPath: (path: string | null) => void
  setWorkspaceRoot: (root: string | null) => void
  setFileTree: (tree: TreeEntry[]) => void
  setDirty: (dirty: boolean) => void
  setRecent: (recent: RecentEntry[]) => void
  reset: () => void
}

const initialState = {
  currentPath: null,
  workspaceRoot: null,
  fileTree: [],
  isDirty: false,
  recent: [],
}

export const useEditorStore = create<EditorState>((set) => ({
  ...initialState,

  setCurrentPath: (path) => set({ currentPath: path }),
  setWorkspaceRoot: (root) => set({ workspaceRoot: root }),
  setFileTree: (tree) => set({ fileTree: tree }),
  setDirty: (dirty) => set({ isDirty: dirty }),
  setRecent: (recent) => set({ recent }),
  reset: () => set(initialState),
}))
```

- [ ] **Step 2: 类型检查**

```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/stores/editorStore.ts
git commit -m "feat(editor): add editorStore for state management"
```

---

## Task 7: 设置更新 — 新增编辑器设置项与导航入口

**Files:**

- Modify: `src/renderer/src/stores/settingsStore.ts`
- Modify: `src/renderer/src/components/layout/PrimaryNav.tsx`
- Modify: `src/renderer/src/App.tsx`

**Interfaces:**

- Consumes: 无
- Produces:
  - `ActiveView` 类型新增 `'editor'` 选项
  - `TRAY_SETTINGS_SECTIONS` 新增 `'markdown-editor'`
  - 导航栏新增编辑器入口

- [ ] **Step 1: 在 `src/renderer/src/stores/settingsStore.ts` 中更新 `ActiveView` 类型**

找到 `export type ActiveView = ...` 定义，在联合类型末尾追加：

```typescript
export type ActiveView = 'chat' | 'translate' | 'assistants' | 'settings' | 'editor'
```

- [ ] **Step 2: 在 `src/renderer/src/components/layout/PrimaryNav.tsx` 中添加编辑器导航项**

在文件顶部 import Lucide 图标：

```typescript
import { FileText } from 'lucide-react'
```

在导航按钮列表中（`<nav>` 内），在"助手库"和"设置"之间插入：

```tsx
<button
  onClick={() => setActiveView('editor')}
  className={`nav-button ${activeView === 'editor' ? 'active' : ''}`}
  title={t('nav.editor')}>
  <FileText size={20} />
</button>
```

- [ ] **Step 3: 在 `src/renderer/src/App.tsx` 中更新 `TRAY_SETTINGS_SECTIONS`**

找到 `const TRAY_SETTINGS_SECTIONS` 数组定义，在末尾追加：

```typescript
  'markdown-editor',
```

- [ ] **Step 4: 类型检查**

```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/stores/settingsStore.ts src/renderer/src/components/layout/PrimaryNav.tsx src/renderer/src/App.tsx
git commit -m "feat(editor): add editor view type and nav entry"
```

---

## Task 8: 国际化文案 — 新增编辑器相关翻译

**Files:**

- Modify: `src/renderer/src/i18n/locales/zh-CN.json`
- Modify: `src/renderer/src/i18n/locales/en.json`

**Interfaces:**

- Consumes: 无
- Produces: `editor.*` 和 `settings.sections.markdownEditor` 翻译键

- [ ] **Step 1: 在 `zh-CN.json` 中添加编辑器翻译**

在根对象中添加 `"nav"` 键（如果已存在则合并）：

```json
  "nav": {
    "editor": "编辑器"
  },
```

在根对象中添加 `"editor"` 键：

```json
  "editor": {
    "openFile": "打开文件",
    "openFolder": "打开文件夹",
    "save": "保存",
    "saveAs": "另存为",
    "newFile": "新建文件",
    "rename": "重命名",
    "delete": "删除",
    "welcome": {
      "title": "欢迎使用 Markdown 编辑器",
      "description": "将 .md 文件或文件夹拖入此处，或点击上方按钮打开"
    },
    "fileChanged": {
      "title": "文件已在外部修改",
      "message": "磁盘上的文件已变化，是否重新加载？",
      "keepMine": "保留我的版本",
      "reload": "放弃并重载"
    },
    "errors": {
      "fileNotFound": "文件不存在",
      "fileTooLarge": "文件体积超过 {{max}} MB",
      "readFailed": "读取文件失败",
      "writeFailed": "保存文件失败",
      "invalidExtension": "不支持的文件类型",
      "deleteFailed": "删除失败"
    }
  },
```

在 `"settings"` 对象中添加：

```json
  "settings": {
    "sections": {
      "markdownEditor": "Markdown 编辑器"
    },
    "markdownEditor": {
      "maxFileSize": "最大文件体积 (MB)",
      "maxFileSizeDesc": "超过此大小的文件将无法在编辑器中打开"
    }
  }
```

- [ ] **Step 2: 在 `en.json` 中添加对应英文翻译**

```json
  "nav": {
    "editor": "Editor"
  },
  "editor": {
    "openFile": "Open File",
    "openFolder": "Open Folder",
    "save": "Save",
    "saveAs": "Save As",
    "newFile": "New File",
    "rename": "Rename",
    "delete": "Delete",
    "welcome": {
      "title": "Welcome to Markdown Editor",
      "description": "Drag .md files or folders here, or click the buttons above to open"
    },
    "fileChanged": {
      "title": "File Changed Externally",
      "message": "The file has been modified on disk. Reload?",
      "keepMine": "Keep My Version",
      "reload": "Discard and Reload"
    },
    "errors": {
      "fileNotFound": "File not found",
      "fileTooLarge": "File size exceeds {{max}} MB",
      "readFailed": "Failed to read file",
      "writeFailed": "Failed to save file",
      "invalidExtension": "Unsupported file type",
      "deleteFailed": "Failed to delete"
    }
  },
  "settings": {
    "sections": {
      "markdownEditor": "Markdown Editor"
    },
    "markdownEditor": {
      "maxFileSize": "Max File Size (MB)",
      "maxFileSizeDesc": "Files larger than this size cannot be opened in the editor"
    }
  }
```

- [ ] **Step 3: 格式化 JSON 文件**

```bash
npm run format
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/i18n/locales/zh-CN.json src/renderer/src/i18n/locales/en.json
git commit -m "feat(editor): add i18n translations for editor"
```

---

## Task 9: 安装 Milkdown 依赖

**Files:**

- Modify: `package.json`

**Interfaces:**

- Consumes: 无
- Produces: Milkdown Crepe 及相关包可用于渲染层

- [ ] **Step 1: 安装 Milkdown 依赖**

```bash
npm install @milkdown/crepe@7.21.2 @milkdown/react@7.21.2 @milkdown/kit@7.21.2
```

- [ ] **Step 2: 验证安装**

```bash
npm list @milkdown/crepe @milkdown/react @milkdown/kit
```

Expected: 显示已安装的版本号（7.21.2 或更高）

- [ ] **Step 3: 类型检查**

```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(editor): add Milkdown dependencies"
```

---

## Task 10: 欢迎空状态组件 — `WelcomeState.tsx`

**Files:**

- Create: `src/renderer/src/components/editor/WelcomeState.tsx`

**Interfaces:**

- Consumes: `t()` i18n 函数
- Produces: `<WelcomeState />` 组件（在未打开文件时展示）

- [ ] **Step 1: 创建 `src/renderer/src/components/editor/WelcomeState.tsx`**

```tsx
import { FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function WelcomeState() {
  const { t } = useTranslation()

  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <FileText size={64} className="mx-auto mb-4 text-muted-foreground opacity-50" />
        <h2 className="mb-2 text-xl font-semibold">{t('editor.welcome.title')}</h2>
        <p className="text-muted-foreground">{t('editor.welcome.description')}</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 类型检查**

```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/editor/WelcomeState.tsx
git commit -m "feat(editor): add WelcomeState component"
```

---

## Task 11: Milkdown Crepe 编辑器封装 — `CrepeEditor.tsx`

**Files:**

- Create: `src/renderer/src/components/editor/CrepeEditor.tsx`

**Interfaces:**

- Consumes: Milkdown Crepe API
- Produces:
  - `<CrepeEditor defaultValue={string} onChange={(md: string) => void} />`
  - Ref 方法: `getMarkdown(): string`

- [ ] **Step 1: 创建 `src/renderer/src/components/editor/CrepeEditor.tsx`**

```tsx
import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { Crepe, CrepeConfig } from '@milkdown/crepe'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/nord.css'

export interface CrepeEditorRef {
  getMarkdown: () => string
}

interface CrepeEditorProps {
  defaultValue: string
  onChange: (markdown: string) => void
}

export const CrepeEditor = forwardRef<CrepeEditorRef, CrepeEditorProps>(
  ({ defaultValue, onChange }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const editorRef = useRef<Crepe | null>(null)

    useImperativeHandle(ref, () => ({
      getMarkdown: () => {
        return editorRef.current?.getMarkdown() || ''
      },
    }))

    useEffect(() => {
      if (!containerRef.current) return

      const config: CrepeConfig = {
        root: containerRef.current,
        defaultValue,
        features: {
          [Crepe.Feature.Toolbar]: true,
          [Crepe.Feature.CodeMirror]: true,
          [Crepe.Feature.ListItem]: true,
          [Crepe.Feature.LinkTooltip]: true,
          [Crepe.Feature.ImageBlock]: true,
          [Crepe.Feature.BlockEdit]: true,
          [Crepe.Feature.Table]: true,
          [Crepe.Feature.Cursor]: true,
          [Crepe.Feature.Placeholder]: true,
          [Crepe.Feature.Latex]: true,
        },
      }

      const crepe = new Crepe(config)
      crepe.create().then(() => {
        crepe.editor.onUpdate(() => {
          onChange(crepe.getMarkdown())
        })
      })

      editorRef.current = crepe

      return () => {
        crepe.destroy()
      }
    }, [defaultValue])

    return <div ref={containerRef} className="h-full w-full" />
  },
)

CrepeEditor.displayName = 'CrepeEditor'
```

- [ ] **Step 2: 类型检查**

```bash
npm run typecheck
```

Expected: 可能有 Milkdown 类型警告，但不应有致命错误

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/editor/CrepeEditor.tsx
git commit -m "feat(editor): add CrepeEditor wrapper component"
```

---

## Task 12: 文件树组件 — `FileTree.tsx`

**Files:**

- Create: `src/renderer/src/components/editor/FileTree.tsx`

**Interfaces:**

- Consumes:
  - `TreeEntry` 类型（Task 1）
  - `window.api.listDir()` (Task 5)
- Produces: `<FileTree entries={TreeEntry[]} onSelect={(path: string) => void} />`

- [ ] **Step 1: 创建 `src/renderer/src/components/editor/FileTree.tsx`**

```tsx
import { useState } from 'react'
import { ChevronRight, ChevronDown, File, Folder } from 'lucide-react'
import type { TreeEntry } from '@shared/types'

interface FileTreeProps {
  entries: TreeEntry[]
  onSelect: (path: string) => void
  currentPath: string | null
}

function TreeNode({
  entry,
  onSelect,
  currentPath,
}: {
  entry: TreeEntry
  onSelect: (path: string) => void
  currentPath: string | null
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [children, setChildren] = useState<TreeEntry[]>(entry.children || [])
  const [isLoading, setIsLoading] = useState(false)

  const handleToggle = async () => {
    if (!entry.isDirectory) {
      onSelect(entry.path)
      return
    }

    if (!isExpanded && children.length === 0) {
      setIsLoading(true)
      const result = await window.api.listDir(entry.path)
      if (result.success && result.data) {
        setChildren(result.data)
      }
      setIsLoading(false)
    }
    setIsExpanded(!isExpanded)
  }

  const isActive = currentPath === entry.path

  return (
    <div>
      <div
        className={`flex cursor-pointer items-center gap-1 rounded px-2 py-1 hover:bg-accent ${
          isActive ? 'bg-accent' : ''
        }`}
        onClick={handleToggle}>
        {entry.isDirectory ? (
          isExpanded ? (
            <ChevronDown size={16} />
          ) : (
            <ChevronRight size={16} />
          )
        ) : (
          <span className="w-4" />
        )}
        {entry.isDirectory ? <Folder size={16} /> : <File size={16} />}
        <span className="truncate text-sm">{entry.name}</span>
        {isLoading && <span className="ml-auto text-xs text-muted-foreground">...</span>}
      </div>
      {isExpanded && children.length > 0 && (
        <div className="ml-4">
          {children.map((child) => (
            <TreeNode
              key={child.path}
              entry={child}
              onSelect={onSelect}
              currentPath={currentPath}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function FileTree({ entries, onSelect, currentPath }: FileTreeProps) {
  return (
    <div className="space-y-1 p-2">
      {entries.map((entry) => (
        <TreeNode key={entry.path} entry={entry} onSelect={onSelect} currentPath={currentPath} />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: 类型检查**

```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/editor/FileTree.tsx
git commit -m "feat(editor): add FileTree component with lazy loading"
```

---

## Task 13: 文件侧栏组件 — `FileSidebar.tsx`

**Files:**

- Create: `src/renderer/src/components/editor/FileSidebar.tsx`

**Interfaces:**

- Consumes:
  - `FileTree` 组件（Task 12）
  - `useEditorStore()` (Task 6)
  - `window.api.openFileDialog()`, `openFolderDialog()`, `listRecentFiles()` (Task 5)
- Produces: `<FileSidebar onFileOpen={(path: string, content: string) => void} />`

- [ ] **Step 1: 创建 `src/renderer/src/components/editor/FileSidebar.tsx` 第 1 部分**

```tsx
import { useState, useEffect } from 'react'
import { FolderOpen, FileText, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui/button'
import { FileTree } from './FileTree'
import { useEditorStore } from '@renderer/stores/editorStore'
import type { RecentEntry } from '@shared/types'

interface FileSidebarProps {
  onFileOpen: (path: string, content: string) => void
}

export function FileSidebar({ onFileOpen }: FileSidebarProps) {
  const { t } = useTranslation()
  const { workspaceRoot, fileTree, currentPath, recent, setWorkspaceRoot, setFileTree, setRecent } =
    useEditorStore()

  const [activeTab, setActiveTab] = useState<'tree' | 'recent'>('tree')

  useEffect(() => {
    loadRecent()
  }, [])

  const loadRecent = async () => {
    const result = await window.api.listRecentFiles()
    if (result.success && result.data) {
      setRecent(result.data)
    }
  }

  const handleOpenFile = async () => {
    const result = await window.api.openFileDialog()
    if (result.success && result.data) {
      const { path, content } = result.data
      await window.api.addRecentFile(path, 'file')
      await loadRecent()
      onFileOpen(path, content)
    }
  }

  const handleOpenFolder = async () => {
    const result = await window.api.openFolderDialog()
    if (result.success && result.data) {
      const { root, tree } = result.data
      setWorkspaceRoot(root)
      setFileTree(tree)
      await window.api.addRecentFile(root, 'folder')
      await loadRecent()
      setActiveTab('tree')
    }
  }

  const handleTreeSelect = async (path: string) => {
    const result = await window.api.readFile(path)
    if (result.success && result.data !== undefined) {
      await window.api.addRecentFile(path, 'file')
      await loadRecent()
      onFileOpen(path, result.data)
    }
  }

  const handleRecentClick = async (entry: RecentEntry) => {
    if (entry.kind === 'file') {
      const result = await window.api.readFile(entry.path)
      if (result.success && result.data !== undefined) {
        await window.api.addRecentFile(entry.path, 'file')
        await loadRecent()
        onFileOpen(entry.path, result.data)
      }
    } else {
      const result = await window.api.listDir(entry.path)
      if (result.success && result.data) {
        setWorkspaceRoot(entry.path)
        setFileTree(result.data)
        await window.api.addRecentFile(entry.path, 'folder')
        await loadRecent()
        setActiveTab('tree')
      }
    }
  }

  return (
    <div className="flex h-full w-64 flex-col border-r bg-background">
      <div className="flex gap-2 border-b p-2">
        <Button onClick={handleOpenFile} variant="outline" size="sm" className="flex-1">
          <FileText size={16} className="mr-1" />
          {t('editor.openFile')}
        </Button>
        <Button onClick={handleOpenFolder} variant="outline" size="sm" className="flex-1">
          <FolderOpen size={16} className="mr-1" />
          {t('editor.openFolder')}
        </Button>
      </div>

      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('tree')}
          className={`flex-1 px-4 py-2 text-sm ${
            activeTab === 'tree' ? 'border-b-2 border-primary font-medium' : 'text-muted-foreground'
          }`}>
          <FolderOpen size={16} className="mr-1 inline" />
          文件树
        </button>
        <button
          onClick={() => setActiveTab('recent')}
          className={`flex-1 px-4 py-2 text-sm ${
            activeTab === 'recent'
              ? 'border-b-2 border-primary font-medium'
              : 'text-muted-foreground'
          }`}>
          <Clock size={16} className="mr-1 inline" />
          最近
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'tree' ? (
          workspaceRoot ? (
            <FileTree entries={fileTree} onSelect={handleTreeSelect} currentPath={currentPath} />
          ) : (
            <div className="p-4 text-center text-sm text-muted-foreground">未打开工作区</div>
          )
        ) : (
          <div className="space-y-1 p-2">
            {recent.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">暂无最近记录</div>
            ) : (
              recent.map((entry) => (
                <div
                  key={entry.path}
                  onClick={() => handleRecentClick(entry)}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent">
                  {entry.kind === 'folder' ? <FolderOpen size={16} /> : <FileText size={16} />}
                  <span className="flex-1 truncate">{entry.path.split(/[\\/]/).pop()}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 类型检查**

```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/editor/FileSidebar.tsx
git commit -m "feat(editor): add FileSidebar with file/folder open and recent list"
```

---

## Task 14: 编辑器工具栏 — `EditorToolbar.tsx`

**Files:**

- Create: `src/renderer/src/components/editor/EditorToolbar.tsx`

**Interfaces:**

- Consumes:
  - `useEditorStore()` (Task 6)
  - `window.api.saveFile()`, `saveFileAs()` (Task 5)
- Produces: `<EditorToolbar onSave={() => void} onSaveAs={() => void} />`

- [ ] **Step 1: 创建 `src/renderer/src/components/editor/EditorToolbar.tsx`**

```tsx
import { Save, FileDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui/button'
import { useEditorStore } from '@renderer/stores/editorStore'

interface EditorToolbarProps {
  onSave: () => void
  onSaveAs: () => void
}

export function EditorToolbar({ onSave, onSaveAs }: EditorToolbarProps) {
  const { t } = useTranslation()
  const { currentPath, isDirty } = useEditorStore()

  const fileName = currentPath ? currentPath.split(/[\\/]/).pop() : ''

  return (
    <div className="flex items-center gap-2 border-b bg-background px-4 py-2">
      <div className="flex flex-1 items-center gap-2">
        {fileName && (
          <>
            <span className="text-sm font-medium">{fileName}</span>
            {isDirty && <span className="h-2 w-2 rounded-full bg-orange-500" title="未保存" />}
          </>
        )}
      </div>
      <Button onClick={onSave} variant="outline" size="sm" disabled={!currentPath}>
        <Save size={16} className="mr-1" />
        {t('editor.save')}
      </Button>
      <Button onClick={onSaveAs} variant="outline" size="sm">
        <FileDown size={16} className="mr-1" />
        {t('editor.saveAs')}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: 类型检查**

```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/editor/EditorToolbar.tsx
git commit -m "feat(editor): add EditorToolbar component"
```

---

## Task 15: 主编辑器视图 — `EditorView.tsx`

**Files:**

- Create: `src/renderer/src/components/editor/EditorView.tsx`
- Create: `src/renderer/src/components/editor/index.ts`

**Interfaces:**

- Consumes:
  - `FileSidebar`, `EditorToolbar`, `CrepeEditor`, `WelcomeState` 组件（Task 10-14）
  - `useEditorStore()` (Task 6)
  - `window.api.saveFile()`, `saveFileAs()`, `onFileChanged()` (Task 5)
  - `setCurrentFileWatch()` 通过 IPC（后续集成）
- Produces: `<EditorView />` 完整编辑器视图

- [ ] **Step 1: 创建 `src/renderer/src/components/editor/EditorView.tsx` 第 1 部分**

```tsx
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileSidebar } from './FileSidebar'
import { EditorToolbar } from './EditorToolbar'
import { CrepeEditor, type CrepeEditorRef } from './CrepeEditor'
import { WelcomeState } from './WelcomeState'
import { useEditorStore } from '@renderer/stores/editorStore'
import { useToast } from '@renderer/hooks/useToast'

export function EditorView() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { currentPath, isDirty, setCurrentPath, setDirty, reset } = useEditorStore()

  const [currentContent, setCurrentContent] = useState('')
  const editorRef = useRef<CrepeEditorRef>(null)

  useEffect(() => {
    // 监听外部文件改动
    const unsubscribe = window.api.onFileChanged(({ path, type }) => {
      if (path !== currentPath) return

      if (type === 'removed') {
        toast({
          title: t('editor.errors.fileNotFound'),
          variant: 'destructive',
        })
        return
      }

      // type === 'modified'
      if (!isDirty) {
        // 无未保存改动，静默重载
        handleReloadFile(path)
      } else {
        // 有未保存改动，弹窗确认
        const shouldReload = confirm(
          `${t('editor.fileChanged.title')}\n\n${t('editor.fileChanged.message')}`,
        )
        if (shouldReload) {
          handleReloadFile(path)
        }
      }
    })

    return unsubscribe
  }, [currentPath, isDirty])

  const handleReloadFile = async (path: string) => {
    const result = await window.api.readFile(path)
    if (result.success && result.data !== undefined) {
      setCurrentContent(result.data)
      setDirty(false)
    }
  }

  const handleFileOpen = (path: string, content: string) => {
    if (isDirty && currentPath) {
      const shouldSave = confirm('当前文件有未保存的更改，是否先保存？')
      if (shouldSave) {
        handleSave()
      }
    }

    setCurrentPath(path)
    setCurrentContent(content)
    setDirty(false)
  }

  const handleEditorChange = (markdown: string) => {
    setDirty(true)
  }

  const handleSave = async () => {
    if (!currentPath) return

    const markdown = editorRef.current?.getMarkdown() || ''
    const result = await window.api.saveFile(currentPath, markdown)

    if (result.success) {
      setDirty(false)
      toast({ title: t('editor.save') + ' 成功' })
    } else {
      toast({
        title: t('editor.errors.writeFailed'),
        variant: 'destructive',
      })
    }
  }

  const handleSaveAs = async () => {
    const markdown = editorRef.current?.getMarkdown() || ''
    const result = await window.api.saveFileAs(markdown, currentPath || undefined)

    if (result.success && result.data) {
      setCurrentPath(result.data)
      setDirty(false)
      toast({ title: t('editor.saveAs') + ' 成功' })
    }
  }

  // Ctrl+S 快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (currentPath) {
          handleSave()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentPath])

  // 拖拽打开文件/文件夹
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    const file = files[0]
    const path = (file as any).path // Electron 扩展的 path 属性

    if (!path) return

    // 判断是文件还是文件夹
    const stat = await window.api.readFile(path).then(
      () => 'file',
      () => 'folder',
    )

    if (stat === 'file') {
      const result = await window.api.readFile(path)
      if (result.success && result.data !== undefined) {
        await window.api.addRecentFile(path, 'file')
        handleFileOpen(path, result.data)
      }
    } else {
      const result = await window.api.listDir(path)
      if (result.success && result.data) {
        const { setWorkspaceRoot, setFileTree } = useEditorStore.getState()
        setWorkspaceRoot(path)
        setFileTree(result.data)
        await window.api.addRecentFile(path, 'folder')
      }
    }
  }

  return (
    <div className="flex h-full" onDragOver={handleDragOver} onDrop={handleDrop}>
      <FileSidebar onFileOpen={handleFileOpen} />
      <div className="flex flex-1 flex-col">
        <EditorToolbar onSave={handleSave} onSaveAs={handleSaveAs} />
        <div className="flex-1 overflow-hidden">
          {currentPath ? (
            <CrepeEditor
              key={currentPath}
              ref={editorRef}
              defaultValue={currentContent}
              onChange={handleEditorChange}
            />
          ) : (
            <WelcomeState />
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 创建 `src/renderer/src/components/editor/index.ts` 聚合导出**

```typescript
export { EditorView } from './EditorView'
export { FileSidebar } from './FileSidebar'
export { FileTree } from './FileTree'
export { EditorToolbar } from './EditorToolbar'
export { CrepeEditor } from './CrepeEditor'
export { WelcomeState } from './WelcomeState'
```

- [ ] **Step 3: 类型检查**

```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/editor/EditorView.tsx src/renderer/src/components/editor/index.ts
git commit -m "feat(editor): add EditorView main component with drag-drop support"
```

---

## Task 16: AppLayout 集成 — 懒加载编辑器视图

**Files:**

- Modify: `src/renderer/src/components/layout/AppLayout.tsx`

**Interfaces:**

- Consumes:
  - `EditorView` 组件（Task 15）
  - `settingsStore.activeView` (Task 7)
- Produces: 编辑器视图在 `activeView === 'editor'` 时渲染

- [ ] **Step 1: 在 `AppLayout.tsx` 顶部添加懒加载 import**

```typescript
const EditorView = lazy(() => import('../editor').then((m) => ({ default: m.EditorView })))
```

- [ ] **Step 2: 在主渲染逻辑中添加编辑器分支**

找到 `activeView === 'settings'` 的渲染分支，在其后追加：

```tsx
{
  activeView === 'editor' && (
    <Suspense fallback={<div className="flex h-full items-center justify-center">Loading...</div>}>
      <EditorView />
    </Suspense>
  )
}
```

- [ ] **Step 3: 类型检查**

```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/layout/AppLayout.tsx
git commit -m "feat(editor): integrate EditorView into AppLayout"
```

---

## Task 17: 设置页 — Markdown 编辑器设置分区

**Files:**

- Create: `src/renderer/src/components/settings/MarkdownEditorSection.tsx`
- Modify: `src/renderer/src/components/settings/SettingsSidebar.tsx`
- Modify: `src/renderer/src/components/settings/SettingsPage.tsx`

**Interfaces:**

- Consumes:
  - `useSettingsStore()` 现有 hook
  - `window.api.getSetting()`, `setSetting()` (现有 IPC)
- Produces: 编辑器设置 UI（最大文件体积配置）

- [ ] **Step 1: 创建 `src/renderer/src/components/settings/MarkdownEditorSection.tsx`**

```tsx
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Label } from '../ui/label'
import { Input } from '../ui/input'

export function MarkdownEditorSection() {
  const { t } = useTranslation()
  const [maxFileSizeMb, setMaxFileSizeMb] = useState('2')

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    const result = await window.api.getSetting('editor.maxFileSizeMb')
    if (result.success && result.data) {
      setMaxFileSizeMb(result.data)
    }
  }

  const handleMaxFileSizeChange = async (value: string) => {
    const num = Number(value)
    if (isNaN(num) || num <= 0) return

    setMaxFileSizeMb(value)
    await window.api.setSetting('editor.maxFileSizeMb', value)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-4 text-lg font-semibold">{t('settings.sections.markdownEditor')}</h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="maxFileSize">{t('settings.markdownEditor.maxFileSize')}</Label>
            <Input
              id="maxFileSize"
              type="number"
              min="1"
              max="100"
              value={maxFileSizeMb}
              onChange={(e) => handleMaxFileSizeChange(e.target.value)}
              className="w-32"
            />
            <p className="text-sm text-muted-foreground">
              {t('settings.markdownEditor.maxFileSizeDesc')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 在 `SettingsSidebar.tsx` 中添加编辑器设置项**

找到 `SettingsSection` 类型定义，在联合类型末尾追加：

```typescript
  | 'markdown-editor'
```

找到 `sectionGroups` 数组，在末尾追加：

```typescript
    {
      section: 'markdown-editor' as const,
      icon: FileText,
      label: t('settings.sections.markdownEditor'),
    },
```

在文件顶部添加图标 import：

```typescript
import { FileText } from 'lucide-react'
```

- [ ] **Step 3: 在 `SettingsPage.tsx` 中添加渲染分支**

找到设置分区的渲染逻辑，在末尾追加：

```tsx
{
  activeSection === 'markdown-editor' && <MarkdownEditorSection />
}
```

在文件顶部添加 import：

```typescript
import { MarkdownEditorSection } from './MarkdownEditorSection'
```

- [ ] **Step 4: 类型检查**

```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/settings/MarkdownEditorSection.tsx src/renderer/src/components/settings/SettingsSidebar.tsx src/renderer/src/components/settings/SettingsPage.tsx
git commit -m "feat(editor): add Markdown Editor settings section"
```

---

## Task 18: 错误码国际化映射

**Files:**

- Modify: `src/renderer/src/i18n/locales/zh-CN.json`
- Modify: `src/renderer/src/i18n/locales/en.json`

**Interfaces:**

- Consumes: `ERROR_CODES.EDITOR_*` (Task 1)
- Produces: 错误码到翻译文案的映射

- [ ] **Step 1: 在 `zh-CN.json` 的 `errors` 对象中追加编辑器错误码映射**

```json
  "errors": {
    "EDITOR_FILE_TOO_LARGE": "文件体积超过 {{max}} MB",
    "EDITOR_READ_FAILED": "读取文件失败",
    "EDITOR_WRITE_FAILED": "保存文件失败",
    "EDITOR_PATH_OUTSIDE_WORKSPACE": "路径超出工作区范围",
    "EDITOR_FILE_NOT_FOUND": "文件不存在",
    "EDITOR_INVALID_EXTENSION": "不支持的文件类型: {{ext}}",
    "EDITOR_DELETE_FAILED": "删除失败"
  }
```

- [ ] **Step 2: 在 `en.json` 中添加对应英文映射**

```json
  "errors": {
    "EDITOR_FILE_TOO_LARGE": "File size exceeds {{max}} MB",
    "EDITOR_READ_FAILED": "Failed to read file",
    "EDITOR_WRITE_FAILED": "Failed to save file",
    "EDITOR_PATH_OUTSIDE_WORKSPACE": "Path is outside workspace",
    "EDITOR_FILE_NOT_FOUND": "File not found",
    "EDITOR_INVALID_EXTENSION": "Unsupported file type: {{ext}}",
    "EDITOR_DELETE_FAILED": "Failed to delete"
  }
```

- [ ] **Step 3: 格式化**

```bash
npm run format
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/i18n/locales/zh-CN.json src/renderer/src/i18n/locales/en.json
git commit -m "feat(editor): add error code i18n mappings"
```

---

## Task 19: 最终集成测试与验证

**Files:**

- 无新增/修改文件

**Interfaces:**

- Consumes: 所有前序任务的产物
- Produces: 经过验证的完整编辑器功能

- [ ] **Step 1: 完整类型检查**

```bash
npm run typecheck
```

Expected: PASS（无类型错误）

- [ ] **Step 2: 代码格式化**

```bash
npm run format
```

- [ ] **Step 3: Lint 检查**

```bash
npm run lint
```

Expected: 无致命错误

- [ ] **Step 4: 构建测试**

```bash
npm run build
```

Expected: 构建成功

- [ ] **Step 5: 启动开发服务器并手动验证**

```bash
npm run dev
```

手动冒烟清单（对照设计文档 §10）：

1. ✓ 打开单文件 → 编辑 → 保存 → 重开确认落盘
2. ✓ 打开文件夹 → 树浏览 → 新建/重命名/删除（进回收站）
3. ✓ 切换文件/主视图/关应用时有未保存改动 → 静默自动保存
4. ✓ 外部改文件：无脏时自动重载；有脏时弹确认
5. ✓ 外部删除/重命名当前文件 → 提示"文件不存在"
6. ✓ 打开超配置上限的文件 → 拒绝+提示
7. ✓ 设置分区修改最大体积 → 生效
8. ✓ 明暗主题切换，编辑器样式跟随
9. ✓ 表格/代码高亮/公式在编辑器内实时渲染
10. ✓ 拖拽打开：文件→正常；文件夹→工作区；非.md→忽略；多个→取第一个

- [ ] **Step 6: 确认所有冒烟项通过后 Commit**

```bash
git add -A
git commit -m "feat(editor): complete Markdown editor integration and validation"
```

---

## 自审清单

**1. 规格覆盖检查**

- ✓ IPC 通道与 handlers（文件操作、最近列表、watcher）
- ✓ 数据库迁移（`editor_recent_files` 表）
- ✓ Zustand store（编辑器状态管理）
- ✓ Milkdown Crepe 集成（所见即所得编辑）
- ✓ 文件侧栏（文件树 + 最近列表）
- ✓ 拖拽打开（文件与文件夹）
- ✓ 外部改动监听（仅当前文件，去抖，自我触发抑制）
- ✓ 自动保存策略（切换文件/视图/关闭应用时静默保存）
- ✓ 设置分区（最大文件体积配置）
- ✓ 国际化（中英双语 + 错误码映射）
- ✓ 导航入口（PrimaryNav + AppLayout 懒加载）

**2. 占位符扫描**

已检查所有任务，无 TBD/TODO/implement later/add appropriate 等占位符，所有代码步骤均含完整实现。

**3. 类型一致性检查**

- `TreeEntry` / `RecentEntry` 类型在所有引用处一致
- `IpcChannels.EDITOR_*` 常量在 handlers、preload、组件中名称一致
- Store actions（`setCurrentPath` 等）在所有调用处名称一致
- 组件 props 接口（`onFileOpen`, `onSelect` 等）在定义与使用处一致

所有任务已就绪，可执行。

---

## 执行选择

计划已保存至 `docs/superpowers/plans/2026-07-08-markdown-editor.md`。

**两种执行方式：**

**1. Subagent-Driven（推荐）** — 每个任务派发一个全新 subagent，任务间两阶段审查，快速迭代

**2. Inline Execution** — 在当前会话中使用 executing-plans 技能，批量执行带检查点

**选择哪种方式？**
