import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type { IpcResult, CatalogSyncResult, CatalogSyncStatus } from '@shared/types'
import { getSyncStatus, syncCatalog } from '../catalog-sync'
import { toLocalizedError } from '../errors'

export function registerCatalogHandlers(): void {
  ipcMain.handle(IpcChannels.CATALOG_SYNC_NOW, async (): Promise<IpcResult<CatalogSyncResult>> => {
    try {
      const result = await syncCatalog()
      return { success: true, data: result }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(IpcChannels.CATALOG_GET_STATUS, (): IpcResult<CatalogSyncStatus> => {
    return { success: true, data: getSyncStatus() }
  })
}
