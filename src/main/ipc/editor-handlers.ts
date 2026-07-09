import { dialog, ipcMain, shell, type IpcMainInvokeEvent, type WebContents } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { FSWatcher } from 'node:fs'
import type { IpcResult, TreeEntry, RecentEntry } from '@shared/types'
import { IpcChannels } from '@shared/ipc-channels'
import { ERROR_CODES } from '@shared/errors'
import { AppError } from '../errors'
import { getSetting } from '../db/settings'
import { listRecent, addRecent, removeRecent, clearRecent } from '../db/editor-recent'

const ALLOWED_EXTENSIONS = ['.md', '.markdown']
let currentFileWatcher: FSWatcher | null = null
let lastWriteTimestamp = 0

function getMaxFileSizeMb(): number {
  const value = getSetting('editor.maxFileSizeMb')
  const parsed = value ? Number(value) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 2
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
    throw new AppError(ERROR_CODES.EDITOR_FILE_TOO_LARGE, { max: getMaxFileSizeMb() })
  }
}

function startWatching(filePath: string, sender: WebContents): void {
  if (currentFileWatcher) {
    currentFileWatcher.close()
    currentFileWatcher = null
  }
  let debounceTimer: NodeJS.Timeout | null = null
  try {
    currentFileWatcher = fs.watch(filePath, () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        if (Date.now() - lastWriteTimestamp < 1000) return
        const exists = fs.existsSync(filePath)
        if (sender.isDestroyed()) return
        sender.send(IpcChannels.EDITOR_FILE_CHANGED, {
          path: filePath,
          type: exists ? 'modified' : 'removed',
        })
      }, 300)
    })
  } catch {
    currentFileWatcher = null
  }
}

async function handleOpenFileDialog(
  event: IpcMainInvokeEvent,
): Promise<IpcResult<{ path: string; content: string } | null>> {
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
    startWatching(filePath, event.sender)
    return { success: true, data: { path: filePath, content } }
  } catch (error) {
    if (error instanceof AppError) return { success: false, error: error.toLocalized() }
    return { success: false, error: { code: ERROR_CODES.EDITOR_READ_FAILED } }
  }
}

function listDirectory(dirPath: string): TreeEntry[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  const result: TreeEntry[] = []
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      result.push({ name: entry.name, path: fullPath, isDirectory: true })
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase()
      if (ALLOWED_EXTENSIONS.includes(ext)) {
        result.push({ name: entry.name, path: fullPath, isDirectory: false })
      }
    }
  }
  return result.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

async function handleOpenFolderDialog(): Promise<
  IpcResult<{ root: string; tree: TreeEntry[] } | null>
> {
  try {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) {
      return { success: true, data: null }
    }
    const root = result.filePaths[0]
    return { success: true, data: { root, tree: listDirectory(root) } }
  } catch {
    return { success: false, error: { code: ERROR_CODES.EDITOR_READ_FAILED } }
  }
}

function handleReadFile(event: IpcMainInvokeEvent, filePath: string): IpcResult<string> {
  try {
    checkExtension(filePath)
    checkFileSize(filePath)
    const content = fs.readFileSync(filePath, 'utf-8')
    startWatching(filePath, event.sender)
    return { success: true, data: content }
  } catch (error) {
    if (error instanceof AppError) return { success: false, error: error.toLocalized() }
    return { success: false, error: { code: ERROR_CODES.EDITOR_READ_FAILED } }
  }
}

function handleSaveFile(
  _: IpcMainInvokeEvent,
  filePath: string,
  content: string,
): IpcResult<boolean> {
  try {
    lastWriteTimestamp = Date.now()
    fs.writeFileSync(filePath, content, 'utf-8')
    return { success: true, data: true }
  } catch {
    return { success: false, error: { code: ERROR_CODES.EDITOR_WRITE_FAILED } }
  }
}

async function handleSaveFileAs(
  _: IpcMainInvokeEvent,
  content: string,
  defaultPath?: string,
): Promise<IpcResult<string | null>> {
  try {
    const result = await dialog.showSaveDialog({
      defaultPath,
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
    })
    if (result.canceled || !result.filePath) return { success: true, data: null }
    lastWriteTimestamp = Date.now()
    fs.writeFileSync(result.filePath, content, 'utf-8')
    return { success: true, data: result.filePath }
  } catch {
    return { success: false, error: { code: ERROR_CODES.EDITOR_WRITE_FAILED } }
  }
}

function handleListDir(_: IpcMainInvokeEvent, dirPath: string): IpcResult<TreeEntry[]> {
  try {
    return { success: true, data: listDirectory(dirPath) }
  } catch {
    return { success: false, error: { code: ERROR_CODES.EDITOR_READ_FAILED } }
  }
}

function handleCreateFile(_: IpcMainInvokeEvent, dirPath: string, name: string): IpcResult<string> {
  try {
    if (!name.endsWith('.md') && !name.endsWith('.markdown')) {
      throw new AppError(ERROR_CODES.EDITOR_INVALID_EXTENSION, { ext: path.extname(name) })
    }
    const filePath = path.join(dirPath, name)
    fs.writeFileSync(filePath, '', 'utf-8')
    return { success: true, data: filePath }
  } catch (error) {
    if (error instanceof AppError) return { success: false, error: error.toLocalized() }
    return { success: false, error: { code: ERROR_CODES.EDITOR_WRITE_FAILED } }
  }
}

function handleRename(_: IpcMainInvokeEvent, oldPath: string, newName: string): IpcResult<string> {
  try {
    const newPath = path.join(path.dirname(oldPath), newName)
    fs.renameSync(oldPath, newPath)
    return { success: true, data: newPath }
  } catch {
    return { success: false, error: { code: ERROR_CODES.EDITOR_WRITE_FAILED } }
  }
}

async function handleDelete(_: IpcMainInvokeEvent, filePath: string): Promise<IpcResult<boolean>> {
  try {
    await shell.trashItem(filePath)
    return { success: true, data: true }
  } catch {
    return { success: false, error: { code: ERROR_CODES.EDITOR_DELETE_FAILED } }
  }
}

function handleListRecent(): IpcResult<RecentEntry[]> {
  try {
    return { success: true, data: listRecent() }
  } catch {
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
  } catch {
    return { success: false, data: false }
  }
}

function handleRemoveRecent(_: IpcMainInvokeEvent, filePath: string): IpcResult<boolean> {
  try {
    removeRecent(filePath)
    return { success: true, data: true }
  } catch {
    return { success: false, data: false }
  }
}

function handleClearRecent(): IpcResult<boolean> {
  try {
    clearRecent()
    return { success: true, data: true }
  } catch {
    return { success: false, data: false }
  }
}

export function registerEditorHandlers(): void {
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
