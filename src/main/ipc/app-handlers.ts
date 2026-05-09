import { app, clipboard, ipcMain, nativeImage, session, shell } from 'electron'
import { existsSync, rmSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import fontList from 'font-list'
import { IpcChannels } from '@shared/ipc-channels'
import { toLocalizedError } from '../errors'
import type { AppReleaseInfo, ClipboardImagePayload, IpcResult } from '@shared/types'
import { getDb, closeDatabase } from '../db/database'
import { seedDatabaseDefaults } from '../db/seeds'
import { getDataDir, getResetMarkerPath } from '../utils/paths'
import { fetchLatestReleaseFromGitHub, PROJECT_PAGE_URL, RELEASES_PAGE_URL } from '../auto-updater'
import { markResetting } from '../index'
import { backupSyncService } from '../backup/sync-service'
import { cleanupSelectionService } from '../selection-service'
import { abortAllChatStreams } from './chat-handlers'
import { abortActiveTranslate } from './translate-handlers'
import { abortActiveQuickAssistantStream } from './quick-assistant-handlers'
import { abortActiveSelectionStream } from './selection-handlers'

// Tables cleared by "Clear all chats" — user-generated content only
const CHAT_TABLES = ['messages', 'conversations', 'translation_history'] as const

// Tables cleared by "Clear all settings" — configuration + defaults re-seeded afterwards
const SETTINGS_TABLES = [
  'settings',
  'models',
  'providers',
  'assistants',
  'quick_actions',
  'selection_actions',
  'model_definitions',
  'model_groups',
] as const

function clearTables(tables: readonly string[]): void {
  const db = getDb()
  // NOTE: VACUUM cannot run inside a transaction, so it must stay *outside* the
  // `run()` call below. Do not move it into the transaction.
  const run = db.transaction(() => {
    for (const name of tables) {
      db.exec(`DELETE FROM "${name}"`)
    }
  })
  db.pragma('foreign_keys = OFF')
  try {
    run()
  } finally {
    db.pragma('foreign_keys = ON')
  }
  db.exec('VACUUM')
}

function removeIfExists(path: string): void {
  if (existsSync(path)) {
    rmSync(path, { recursive: true, force: true })
  }
}

export function registerAppHandlers(): void {
  // A) Clear all chats — user content only, no relaunch
  ipcMain.handle(IpcChannels.APP_CLEAR_CHATS, (): IpcResult<void> => {
    try {
      abortAllChatStreams()
      abortActiveTranslate()
      clearTables(CHAT_TABLES)
      removeIfExists(join(getDataDir(), 'attachments'))
      removeIfExists(join(getDataDir(), 'backups', 'auto-rollback'))
      return { success: true }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  // B) Clear all settings — configuration wipe, re-seed defaults, relaunch
  ipcMain.handle(IpcChannels.APP_CLEAR_SETTINGS, (): IpcResult<void> => {
    try {
      abortAllChatStreams()
      abortActiveTranslate()
      abortActiveQuickAssistantStream()
      abortActiveSelectionStream()
      // Stop the auto-sync timer before wiping settings — otherwise a tick
      // between `clearTables` and `app.exit(0)` could read half-seeded state
      // or try to push empty settings to the remote.
      backupSyncService.stop()
      clearTables(SETTINGS_TABLES)
      const windowStatePath = join(getDataDir(), 'window-state.json')
      if (existsSync(windowStatePath)) {
        try {
          unlinkSync(windowStatePath)
        } catch {
          // ignore
        }
      }
      seedDatabaseDefaults()
      app.relaunch()
      app.exit(0)
      return { success: true }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  // C) Reset app — nuke data/ and all Chromium storage, relaunch
  ipcMain.handle(IpcChannels.APP_RESET, async (): Promise<IpcResult<void>> => {
    const resetMarker = getResetMarkerPath()
    try {
      markResetting()
      abortAllChatStreams()
      abortActiveTranslate()
      abortActiveQuickAssistantStream()
      abortActiveSelectionStream()
      backupSyncService.stop()
      cleanupSelectionService()

      try {
        await session.defaultSession.clearStorageData({
          storages: [
            'localstorage',
            'indexdb',
            'cookies',
            'serviceworkers',
            'cachestorage',
            'shadercache',
          ],
        })
      } catch {
        // best-effort — continue even if this fails
      }

      closeDatabase()

      // Marker first — if rmSync throws mid-way, next boot self-heals
      try {
        writeFileSync(resetMarker, '1')
      } catch {
        // ignore — rmSync may still succeed
      }

      try {
        rmSync(getDataDir(), {
          recursive: true,
          force: true,
          maxRetries: 5,
          retryDelay: 200,
        })
        // Success — remove marker so next boot doesn't retry
        try {
          unlinkSync(resetMarker)
        } catch {
          // ignore
        }
      } catch {
        // Leave marker in place; next boot retries before opening DB
      }

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

  ipcMain.handle(IpcChannels.APP_OPEN_PROJECT_PAGE, async (): Promise<IpcResult<void>> => {
    try {
      await shell.openExternal(PROJECT_PAGE_URL)
      return { success: true }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(IpcChannels.APP_OPEN_RELEASES_PAGE, async (): Promise<IpcResult<void>> => {
    try {
      await shell.openExternal(RELEASES_PAGE_URL)
      return { success: true }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(
    IpcChannels.APP_GET_LATEST_RELEASE,
    async (): Promise<IpcResult<AppReleaseInfo>> => {
      try {
        return { success: true, data: await fetchLatestReleaseFromGitHub() }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

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
