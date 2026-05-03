import { ipcMain, dialog } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type { BackupFileMeta, BackupImportMode, BackupSummary, IpcResult } from '@shared/types'
import { ERROR_CODES } from '@shared/errors'
import { toLocalizedError } from '../errors'
import { exportToFile, importFromFile, peekFile } from '../backup'

export function registerBackupHandlers(): void {
  ipcMain.handle(
    IpcChannels.BACKUP_EXPORT_TO_FILE,
    async (_, payload: { password: string }): Promise<IpcResult<{ filePath: string }>> => {
      try {
        const data = await exportToFile(payload.password)
        return { success: true, data }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(
    IpcChannels.BACKUP_PEEK_FILE,
    async (_, payload: { filePath: string }): Promise<IpcResult<BackupFileMeta>> => {
      try {
        const data = await peekFile(payload.filePath)
        return { success: true, data }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(
    IpcChannels.BACKUP_IMPORT_FROM_FILE,
    async (
      _,
      payload: { filePath?: string; password: string; mode: BackupImportMode },
    ): Promise<IpcResult<{ applied: BackupSummary }>> => {
      try {
        let filePath = payload.filePath
        if (!filePath) {
          const result = await dialog.showOpenDialog({
            title: 'Import AI Studio backup',
            filters: [{ name: 'AI Studio Backup', extensions: ['aibackup'] }],
            properties: ['openFile'],
          })
          if (result.canceled || result.filePaths.length === 0) {
            return { success: false, error: { code: ERROR_CODES.BACKUP_CANCELLED } }
          }
          filePath = result.filePaths[0]
        }
        const applied = await importFromFile(filePath, payload.password, payload.mode)
        return { success: true, data: { applied } }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )
}
