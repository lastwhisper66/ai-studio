import { ipcMain, dialog } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type {
  BackupFileMeta,
  BackupImportMode,
  BackupSummary,
  IpcResult,
  RemoteConfig,
  SyncStatus,
} from '@shared/types'
import { ERROR_CODES } from '@shared/errors'
import { toLocalizedError } from '../errors'
import {
  clearRemoteConfig,
  exportToFile,
  importFromFile,
  loadRemoteConfig,
  peekFile,
  saveRemoteConfig,
  testRemote,
} from '../backup'
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
          title: 'Import AI Studio backup',
          filters: [{ name: 'AI Studio Backup', extensions: ['aibackup'] }],
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

  // Stubs — replaced with real implementations in Phase 4 (remote-config) /
  // Phase 5 (sync-service). Registered now so the renderer's initBackupStore()
  // doesn't blow up at boot.
  ipcMain.handle(IpcChannels.BACKUP_GET_REMOTE_CONFIG, (): IpcResult<RemoteConfig | null> => {
    try {
      return { success: true, data: loadRemoteConfig() }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(
    IpcChannels.BACKUP_SET_REMOTE_CONFIG,
    (_, payload: { config: RemoteConfig; passphrase?: string }): IpcResult<void> => {
      try {
        saveRemoteConfig(payload.config)
        // Sync passphrase (used by Phase 5's encrypt-on-upload flow) is optional;
        // persist it only when the renderer actually supplied one. Stored under a
        // SENSITIVE_KEYS-encrypted key so safeStorage protects it at rest.
        if (typeof payload.passphrase === 'string' && payload.passphrase.length > 0) {
          setSetting('backup.syncPassphrase', payload.passphrase)
        }
        return { success: true }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(IpcChannels.BACKUP_CLEAR_REMOTE_CONFIG, (): IpcResult<void> => {
    try {
      clearRemoteConfig()
      return { success: true }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

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

  // Phase 5 placeholder — replaced with real implementation by the sync-service.
  ipcMain.handle(IpcChannels.BACKUP_GET_STATUS, (): IpcResult<SyncStatus> => {
    return {
      success: true,
      data: {
        isSyncing: false,
        lastLocalChangeAt: null,
        lastSyncedAt: null,
        lastRemoteSeenAt: null,
        lastError: null,
        lastWarning: null,
        hasRemoteConfigured: loadRemoteConfig() !== null,
        autoSyncIntervalMinutes: 0,
      },
    }
  })
}
