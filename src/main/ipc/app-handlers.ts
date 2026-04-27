import { app, clipboard, ipcMain, nativeImage } from 'electron'
import { existsSync, rmSync, unlinkSync } from 'fs'
import { join } from 'path'
import fontList from 'font-list'
import { IpcChannels } from '@shared/ipc-channels'
import { toLocalizedError } from '../errors'
import type { ClipboardImagePayload, IpcResult } from '@shared/types'
import { getDb } from '../db/database'
import { seedDatabaseDefaults } from '../db/seeds'
import { getDataDir } from '../utils/paths'

export function registerAppHandlers(): void {
  ipcMain.handle(IpcChannels.APP_CLEAR_DATA, (): IpcResult<void> => {
    try {
      const db = getDb()

      // Dynamically collect all user tables to avoid missing any when new tables are added.
      // Excludes sqlite internal tables (sqlite_*) — SQLite reserves this prefix.
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
        .all() as { name: string }[]

      const clearAll = db.transaction(() => {
        for (const { name } of tables) {
          // name comes from sqlite_master, not user input — safe to interpolate.
          // Quote with double quotes to handle any reserved words.
          db.exec(`DELETE FROM "${name}"`)
        }
      })

      // foreign_keys pragma is a no-op inside a transaction, so toggle it outside.
      // Disabled during bulk delete so row order doesn't matter.
      db.pragma('foreign_keys = OFF')
      try {
        clearAll()
      } finally {
        db.pragma('foreign_keys = ON')
      }

      // Reclaim disk space after bulk deletion
      db.exec('VACUUM')

      // Remove attachments directory
      const attachmentsDir = join(getDataDir(), 'attachments')
      if (existsSync(attachmentsDir)) {
        rmSync(attachmentsDir, { recursive: true, force: true })
      }

      // Remove window state file
      const windowStatePath = join(getDataDir(), 'window-state.json')
      if (existsSync(windowStatePath)) {
        unlinkSync(windowStatePath)
      }

      // Re-seed defaults
      seedDatabaseDefaults()

      // Relaunch the app — app.exit(0) terminates the process,
      // so the return below is unreachable but required by the type signature
      app.relaunch()
      app.exit(0)

      return { success: true }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(IpcChannels.APP_GET_FONTS, async (): Promise<IpcResult<string[]>> => {
    try {
      const fonts = await fontList.getFonts()
      // font-list returns names wrapped in quotes on some platforms — strip them
      const cleaned = fonts.map((f) => f.replace(/^"|"$/g, '')).sort()
      return { success: true, data: cleaned }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(
    IpcChannels.CLIPBOARD_WRITE_IMAGE,
    (_, payload: ClipboardImagePayload): IpcResult<void> => {
      try {
        const image = nativeImage.createFromBuffer(Buffer.from(payload.pngBase64, 'base64'))
        if (image.isEmpty()) {
          throw new Error('Invalid image data')
        }

        const data: Parameters<typeof clipboard.write>[0] = { image }
        if (payload.html) data.html = payload.html
        if (payload.text) data.text = payload.text
        clipboard.write(data)
        return { success: true }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )
}
