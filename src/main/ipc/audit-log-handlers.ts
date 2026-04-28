import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type { IpcResult, ToolCallAuditEntry, ToolCallAuditFilter } from '@shared/types'
import { toLocalizedError } from '../errors'
import { listAuditEntries, getAuditEntry, clearAuditEntries } from '../db'

export function registerAuditLogHandlers(): void {
  ipcMain.handle(
    IpcChannels.AUDIT_LOG_LIST,
    (
      _,
      filter: ToolCallAuditFilter,
    ): IpcResult<{ entries: ToolCallAuditEntry[]; total: number }> => {
      try {
        const data = listAuditEntries(filter)
        return { success: true, data }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(
    IpcChannels.AUDIT_LOG_GET,
    (_, id: string): IpcResult<ToolCallAuditEntry | undefined> => {
      try {
        const data = getAuditEntry(id)
        return { success: true, data }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(IpcChannels.AUDIT_LOG_CLEAR, (_, conversationId?: string): IpcResult<void> => {
    try {
      clearAuditEntries(conversationId)
      return { success: true }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })
}
