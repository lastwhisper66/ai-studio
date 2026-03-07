import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type { IpcResult, TestConnectionPayload, ApiSettings } from '@shared/types'
import { getSetting, setSetting, setSettingsBatch, getAllSettings } from '../db'
import { createAIClient } from '../ai'

export function registerSettingsHandlers(): void {
  ipcMain.handle(IpcChannels.SETTINGS_GET, (_, key: string): IpcResult<string | undefined> => {
    try {
      const data = getSetting(key)
      return { success: true, data }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.SETTINGS_SET, (_, key: string, value: string): IpcResult<void> => {
    try {
      setSetting(key, value)
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.SETTINGS_GET_ALL, (): IpcResult<Record<string, string>> => {
    try {
      const data = getAllSettings()
      return { success: true, data }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(
    IpcChannels.SETTINGS_SET_BATCH,
    (_, entries: Record<string, string>): IpcResult<void> => {
      try {
        setSettingsBatch(entries)
        return { success: true }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    },
  )

  ipcMain.handle(
    IpcChannels.SETTINGS_TEST_CONNECTION,
    async (_, payload: TestConnectionPayload): Promise<IpcResult<string>> => {
      try {
        const settings: ApiSettings = {
          provider: payload.provider,
          apiKey: payload.apiKey,
          baseUrl: payload.baseUrl || undefined,
          endpoint: payload.endpoint || undefined,
          apiVersion: payload.apiVersion || undefined,
          deploymentName: payload.deploymentName || undefined,
          model: payload.model,
          temperature: 0,
          maxTokens: 1,
          systemPrompt: '',
        }

        const client = createAIClient(settings)

        let timerId: ReturnType<typeof setTimeout>
        const timeout = new Promise<never>((_, reject) => {
          timerId = setTimeout(() => reject(new Error('Connection timed out (15s)')), 15000)
        })

        const request = client.chat.completions.create({
          model:
            payload.provider === 'azure' ? payload.deploymentName || payload.model : payload.model,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 1,
        })

        try {
          await Promise.race([request, timeout])
          return { success: true, data: 'Connection successful!' }
        } finally {
          clearTimeout(timerId!)
        }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    },
  )
}
