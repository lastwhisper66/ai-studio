import {
  BrowserWindow,
  ipcMain,
  dialog,
  type IpcMainInvokeEvent,
  type OpenDialogOptions,
} from 'electron'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync } from 'fs'
import { join, extname, normalize, resolve } from 'path'
import { IpcChannels } from '@shared/ipc-channels'
import type { IpcResult } from '@shared/types'
import { toLocalizedError } from '../errors'
import { t } from '../i18n'
import { getDataDir } from '../utils/paths'

let saveAvatarPromise: Promise<IpcResult<string | null>> | null = null

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
    (event: IpcMainInvokeEvent): Promise<IpcResult<string | null>> => {
      saveAvatarPromise ??= saveUserAvatar(event).finally(() => {
        saveAvatarPromise = null
      })
      return saveAvatarPromise
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

async function saveUserAvatar(event: IpcMainInvokeEvent): Promise<IpcResult<string | null>> {
  try {
    const parentWindow = BrowserWindow.fromWebContents(event.sender)
    const options: OpenDialogOptions = {
      properties: ['openFile'],
      filters: [
        {
          name: t('dialog.filePicker.image'),
          extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        },
      ],
    }
    const result = parentWindow
      ? await dialog.showOpenDialog(parentWindow, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) {
      return { success: true, data: null }
    }
    const srcPath = result.filePaths[0]
    const ext = extname(srcPath).toLowerCase() || '.png'
    const filename = `user-avatar${ext}`
    ensureAvatarsDir()
    const avatarsDir = getAvatarsDir()

    for (const f of readdirSync(avatarsDir)) {
      if (f.startsWith('user-avatar')) {
        try {
          unlinkSync(join(avatarsDir, f))
        } catch {
          // best-effort cleanup of old avatar files
        }
      }
    }

    const destPath = join(avatarsDir, filename)
    copyFileSync(srcPath, destPath)

    return { success: true, data: `avatars/${filename}` }
  } catch (e) {
    return { success: false, error: toLocalizedError(e) }
  }
}
