import { ipcMain, dialog } from 'electron'
import { copyFileSync, existsSync, mkdirSync, readFileSync, unlinkSync } from 'fs'
import { join, extname, normalize, resolve } from 'path'
import { randomUUID } from 'crypto'
import { IpcChannels } from '@shared/ipc-channels'
import type { IpcResult } from '@shared/types'
import { toLocalizedError } from '../errors'
import { t } from '../i18n'
import { getDataDir } from '../utils/paths'

function getAvatarsDir(): string {
  return join(getDataDir(), 'avatars')
}

function ensureAvatarsDir(): void {
  const dir = getAvatarsDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

export function registerUserHandlers(): void {
  ipcMain.handle(
    IpcChannels.USER_SAVE_AVATAR,
    async (_, oldRelativePath: string | null): Promise<IpcResult<string | null>> => {
      try {
        const result = await dialog.showOpenDialog({
          properties: ['openFile'],
          filters: [
            {
              name: t('dialog.filePicker.image'),
              extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
            },
          ],
        })
        if (result.canceled || result.filePaths.length === 0) {
          return { success: true, data: null }
        }
        const srcPath = result.filePaths[0]
        const ext = extname(srcPath).toLowerCase() || '.png'
        const filename = `user-avatar-${randomUUID()}${ext}`
        ensureAvatarsDir()
        const destPath = join(getAvatarsDir(), filename)
        copyFileSync(srcPath, destPath)

        if (oldRelativePath) {
          const baseDir = normalize(resolve(getAvatarsDir()))
          const oldFull = normalize(resolve(getDataDir(), oldRelativePath))
          if (oldFull.startsWith(baseDir + '\\') && existsSync(oldFull)) {
            try {
              unlinkSync(oldFull)
            } catch {}
          }
        }

        return { success: true, data: `avatars/${filename}` }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(IpcChannels.USER_READ_AVATAR, (_, relativePath: string): IpcResult<string> => {
    try {
      const baseDir = normalize(resolve(getAvatarsDir()))
      const fullPath = normalize(resolve(getDataDir(), relativePath))
      if (!fullPath.startsWith(baseDir + '\\')) {
        return { success: false, error: { code: 'INVALID_PATH' } }
      }
      if (!existsSync(fullPath)) {
        return { success: false, error: { code: 'NOT_FOUND' } }
      }
      const ext = extname(fullPath).toLowerCase().replace('.', '')
      const mimeMap: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
      }
      const mime = mimeMap[ext] ?? 'image/png'
      const base64 = readFileSync(fullPath).toString('base64')
      return { success: true, data: `data:${mime};base64,${base64}` }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })
}
