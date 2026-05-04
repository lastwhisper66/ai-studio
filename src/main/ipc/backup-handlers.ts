import { ipcMain, dialog } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type {
  BackupFileMeta,
  BackupImportMode,
  BackupSummary,
  IpcResult,
  RemoteBackupItem,
  RemoteConfig,
  RemoteConfigs,
  RemoteType,
  RollbackBackupItem,
  SyncResult,
  SyncStatus,
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
import { setSetting } from '../db/settings'

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
      payload: { filePath?: string; password: string; mode: BackupImportMode },
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
        const applied = await importFromFile(filePath, payload.password, payload.mode)
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

  // Persists a single remote (the other one is left untouched). The optional
  // sync passphrase is shared across all remotes — passing a non-empty value
  // overwrites the previously-stored passphrase; blank means "keep current".
  ipcMain.handle(
    IpcChannels.BACKUP_SET_REMOTE_CONFIG,
    (_, payload: { config: RemoteConfig; passphrase?: string }): IpcResult<void> => {
      try {
        saveRemoteConfig(payload.config)
        if (typeof payload.passphrase === 'string' && payload.passphrase.length > 0) {
          setSetting('backup.syncPassphrase', payload.passphrase)
        }
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

  ipcMain.handle(IpcChannels.BACKUP_GET_STATUS, (): IpcResult<SyncStatus> => {
    try {
      return { success: true, data: backupSyncService.getStatus() }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(IpcChannels.BACKUP_SYNC_NOW, async (): Promise<IpcResult<SyncResult>> => {
    try {
      const data = await backupSyncService.syncNow()
      return { success: true, data }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(IpcChannels.BACKUP_SYNC_CANCEL, (): IpcResult<void> => {
    try {
      backupSyncService.cancel()
      return { success: true }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

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
      payload: { type: RemoteType; key: string; password: string; mode: BackupImportMode },
    ): Promise<IpcResult<void>> => {
      try {
        await backupSyncService.restoreFromKey(
          payload.type,
          payload.key,
          payload.password,
          payload.mode,
        )
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
