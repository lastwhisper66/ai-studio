import { ipcMain, dialog } from 'electron'
import { readFileSync } from 'fs'
import { basename } from 'path'
import { IpcChannels } from '@shared/ipc-channels'
import type { IpcResult, FileData } from '@shared/types'
import { loadAttachmentBase64 } from '../db/attachments'

const MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  json: 'application/json',
  pdf: 'application/pdf',
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

function getMime(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return MIME_MAP[ext] ?? 'application/octet-stream'
}

export function registerFileHandlers(): void {
  ipcMain.handle(IpcChannels.FILE_OPEN_DIALOG, async (): Promise<IpcResult<FileData[]>> => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: '图片', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] },
          { name: '文本文件', extensions: ['txt', 'md', 'csv', 'json'] },
          { name: '所有文件', extensions: ['*'] },
        ],
      })
      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, data: [] }
      }
      const files: FileData[] = []
      const oversized: string[] = []
      for (const fp of result.filePaths) {
        const buf = readFileSync(fp)
        if (buf.length > MAX_FILE_SIZE) {
          oversized.push(basename(fp))
          continue
        }
        files.push({
          name: basename(fp),
          mimeType: getMime(fp),
          base64: buf.toString('base64'),
          size: buf.length,
        })
      }
      if (oversized.length > 0 && files.length === 0) {
        return { success: false, error: `文件过大（最大 10MB）：${oversized.join(', ')}` }
      }
      return { success: true, data: files }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.ATTACHMENT_READ, (_, relativePath: string): IpcResult<string> => {
    try {
      const base64 = loadAttachmentBase64(relativePath)
      return { success: true, data: base64 }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })
}
