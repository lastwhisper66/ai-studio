import { ipcMain, dialog } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type {
  BackupFileMeta,
  BackupImportMode,
  BackupStatus,
  BackupSummary,
  IpcResult,
  RemoteBackupItem,
  RemoteConfig,
  RemoteConfigs,
  RemoteType,
  RollbackBackupItem,
  SyncResult,
} from '@shared/types'
import { ERROR_CODES } from '@shared/errors'
import { toLocalizedError } from '../errors'
import { t } from '../i18n'
import {
  clearRemoteConfig,
  exportToFile,
  importFromFile,
  listRollbacks,
  loadRemoteConfigs,
  peekFile,
  saveRemoteConfig,
  testRemote,
} from '../backup'
import { backupSyncService } from '../backup/sync-service'

export function registerBackupHandlers(): void {
  ipcMain.handle(
    IpcChannels.BACKUP_EXPORT_TO_FILE,
    async (): Promise<IpcResult<{ filePath: string }>> => {
      try {
        const data = await exportToFile()
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
    IpcChannels.BACKUP_PICK_FILE,
    async (): Promise<IpcResult<{ filePath: string } | null>> => {
      try {
        const result = await dialog.showOpenDialog({
          title: t('settings.backup.dialog.importTitle'),
          filters: [{ name: t('settings.backup.dialog.fileFilter'), extensions: ['aibackup'] }],
          properties: ['openFile'],
        })
        if (result.canceled || result.filePaths.length === 0) {
          return { success: true, data: null }
        }
        return { success: true, data: { filePath: result.filePaths[0] } }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(
    IpcChannels.BACKUP_IMPORT_FROM_FILE,
    async (
      _,
      payload: { filePath?: string; mode: BackupImportMode },
    ): Promise<IpcResult<{ applied: BackupSummary }>> => {
      try {
        let filePath = payload.filePath
        if (!filePath) {
          const result = await dialog.showOpenDialog({
            title: t('settings.backup.dialog.importTitle'),
            filters: [{ name: t('settings.backup.dialog.fileFilter'), extensions: ['aibackup'] }],
            properties: ['openFile'],
          })
          if (result.canceled || result.filePaths.length === 0) {
            return { success: false, error: { code: ERROR_CODES.BACKUP_CANCELLED } }
          }
          filePath = result.filePaths[0]
        }
        const applied = await importFromFile(filePath, payload.mode)
        return { success: true, data: { applied } }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  // Returns BOTH remote configs (either field may be null when not configured).
  ipcMain.handle(IpcChannels.BACKUP_GET_REMOTE_CONFIG, (): IpcResult<RemoteConfigs> => {
    try {
      return { success: true, data: loadRemoteConfigs() }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  // Persists a single remote (the other one is left untouched).
  ipcMain.handle(
    IpcChannels.BACKUP_SET_REMOTE_CONFIG,
    (_, payload: { config: RemoteConfig }): IpcResult<void> => {
      try {
        saveRemoteConfig(payload.config)
        return { success: true }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  // Removes ONE remote (webdav or s3) — the other remote is left untouched.
  ipcMain.handle(
    IpcChannels.BACKUP_CLEAR_REMOTE_CONFIG,
    (_, payload: { type: RemoteType }): IpcResult<void> => {
      try {
        clearRemoteConfig(payload.type)
        return { success: true }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(
    IpcChannels.BACKUP_TEST_REMOTE,
    async (_, cfg: RemoteConfig): Promise<IpcResult<{ ok: boolean; latency?: number }>> => {
      try {
        const data = await testRemote(cfg)
        return { success: true, data }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(IpcChannels.BACKUP_GET_STATUS, (): IpcResult<BackupStatus> => {
    try {
      return { success: true, data: backupSyncService.getStatus() }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(
    IpcChannels.BACKUP_SYNC_NOW,
    async (_, payload: { type: RemoteType }): Promise<IpcResult<SyncResult>> => {
      try {
        const data = await backupSyncService.syncNow(payload.type)
        return { success: true, data }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(
    IpcChannels.BACKUP_SYNC_CANCEL,
    (_, payload: { type: RemoteType }): IpcResult<void> => {
      try {
        backupSyncService.syncCancel(payload.type)
        return { success: true }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(
    IpcChannels.BACKUP_SET_REMOTE_ENABLED,
    (_, payload: { type: RemoteType; enabled: boolean }): IpcResult<void> => {
      try {
        backupSyncService.setEnabled(payload.type, payload.enabled)
        return { success: true }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(
    IpcChannels.BACKUP_LIST_REMOTE,
    async (_, payload: { type: RemoteType }): Promise<IpcResult<RemoteBackupItem[]>> => {
      try {
        const data = await backupSyncService.listRemote(payload.type)
        return { success: true, data }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(
    IpcChannels.BACKUP_RESTORE_FROM_REMOTE,
    async (
      _,
      payload: { type: RemoteType; key: string; mode: BackupImportMode },
    ): Promise<IpcResult<void>> => {
      try {
        await backupSyncService.restoreFromKey(payload.type, payload.key, payload.mode)
        return { success: true }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(IpcChannels.BACKUP_LIST_ROLLBACKS, (): IpcResult<RollbackBackupItem[]> => {
    try {
      return { success: true, data: listRollbacks() }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })
}
