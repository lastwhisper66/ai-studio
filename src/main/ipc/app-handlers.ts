import { app, ipcMain } from 'electron'
import { existsSync, rmSync, unlinkSync } from 'fs'
import { join } from 'path'
import { IpcChannels } from '@shared/ipc-channels'
import type { IpcResult } from '@shared/types'
import { getDb, seedDefaultAssistant } from '../db/database'
import { seedModelDefinitions } from '../db/model-definitions'
import { seedModelGroups } from '../db/model-groups'
import { seedDefaultProviders } from '../db/providers'
import { getDataDir } from '../utils/paths'

export function registerAppHandlers(): void {
  ipcMain.handle(IpcChannels.APP_CLEAR_DATA, (): IpcResult<void> => {
    try {
      const db = getDb()

      // NOTE: Update this list when adding new tables
      db.exec(`
        DELETE FROM messages;
        DELETE FROM conversations;
        DELETE FROM settings;
        DELETE FROM models;
        DELETE FROM providers;
        DELETE FROM assistants;
        DELETE FROM phrases;
        DELETE FROM translation_history;
        DELETE FROM model_definitions;
        DELETE FROM model_groups;
      `)

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
      seedModelDefinitions()
      seedModelGroups()
      seedDefaultProviders()
      seedDefaultAssistant()

      // Relaunch the app — app.exit(0) terminates the process,
      // so the return below is unreachable but required by the type signature
      app.relaunch()
      app.exit(0)

      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })
}
