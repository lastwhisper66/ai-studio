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
    (_, payload: TestConnectionPayload): Promise<IpcResult<string>> => {
      console.log('[TestConnection] >>> handler called, provider:', payload.provider)
      // Outer safety net: guarantees a response within 20s no matter what happens inside
      return new Promise((resolve) => {
        const fallbackTimer = setTimeout(() => {
          console.log('[TestConnection] !!! hard timeout (20s) reached')
          resolve({ success: false, error: 'Connection test timed out' })
        }, 20000)

        doTestConnection(payload)
          .then((result) => {
            console.log('[TestConnection] <<< resolved:', result.success, result.error ?? '')
            resolve(result)
          })
          .catch((e) => {
            console.log('[TestConnection] <<< caught error:', e)
            resolve({ success: false, error: 'Connection failed' })
          })
          .finally(() => clearTimeout(fallbackTimer))
      })
    },
  )
}

async function doTestConnection(
  payload: TestConnectionPayload,
): Promise<IpcResult<string>> {
  const controller = new AbortController()
  const timerId = setTimeout(() => controller.abort(), 15000)

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

    console.log('[TestConnection] creating client...')
    const client = createAIClient(settings)

    console.log('[TestConnection] sending streaming request...')
    const stream = await client.chat.completions.create(
      {
        model:
          payload.provider === 'azure'
            ? payload.deploymentName || payload.model
            : payload.model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1,
        stream: true,
      },
      { signal: controller.signal },
    )

    console.log('[TestConnection] stream created, consuming first chunk...')
    try {
      for await (const _chunk of stream) {
        break
      }
    } catch {
      // Stream read error is irrelevant — create() succeeding already proved the connection
    }

    console.log('[TestConnection] success!')
    return { success: true, data: 'Connection successful!' }
  } catch (e) {
    console.log('[TestConnection] error caught:', e)
    if (controller.signal.aborted) {
      return { success: false, error: 'Connection timed out (15s)' }
    }
    const message = e instanceof Error ? e.message : String(e)
    return { success: false, error: message || 'Connection failed' }
  } finally {
    clearTimeout(timerId)
  }
}
