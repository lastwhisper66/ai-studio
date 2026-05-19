import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type { IpcResult, WebSearchTestPayload } from '@shared/types'
import { toLocalizedError } from '../errors'
import { runProviderSearchDirect } from '../web-search'

export function registerWebSearchHandlers(): void {
  ipcMain.handle(
    IpcChannels.WEB_SEARCH_TEST_CONNECTION,
    async (_event, payload: WebSearchTestPayload): Promise<IpcResult<{ resultCount: number }>> => {
      const controller = new AbortController()
      try {
        const results = await runProviderSearchDirect({
          ...payload,
          query: 'ai studio test query',
          maxResults: 3,
          timeoutMs: 10_000,
          signal: controller.signal,
        })
        return { success: true, data: { resultCount: results.length } }
      } catch (err) {
        return { success: false, error: toLocalizedError(err) }
      }
    },
  )
}
