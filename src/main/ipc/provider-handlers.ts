import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type { IpcResult, Provider, ApiSettings, ProviderConnectionTestPayload } from '@shared/types'
import {
  listProviders,
  getProvider,
  createProvider,
  updateProvider,
  deleteProvider,
  reorderProviders,
} from '../db'
import type { CreateProviderData, UpdateProviderData } from '../db/providers'
import { createAIClient } from '../ai'

export function registerProviderHandlers(): void {
  ipcMain.handle(IpcChannels.PROVIDER_LIST, (): IpcResult<Provider[]> => {
    try {
      const data = listProviders()
      return { success: true, data }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.PROVIDER_GET, (_, id: string): IpcResult<Provider | undefined> => {
    try {
      const data = getProvider(id)
      return { success: true, data }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(
    IpcChannels.PROVIDER_CREATE,
    (_, data: CreateProviderData): IpcResult<Provider> => {
      try {
        const provider = createProvider(data)
        return { success: true, data: provider }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    },
  )

  ipcMain.handle(
    IpcChannels.PROVIDER_UPDATE,
    (_, id: string, data: UpdateProviderData): IpcResult<Provider | undefined> => {
      try {
        const provider = updateProvider(id, data)
        return { success: true, data: provider }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    },
  )

  ipcMain.handle(IpcChannels.PROVIDER_DELETE, (_, id: string): IpcResult<void> => {
    try {
      deleteProvider(id)
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.PROVIDER_REORDER, (_, ids: string[]): IpcResult<void> => {
    try {
      reorderProviders(ids)
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(
    IpcChannels.PROVIDER_TEST_CONNECTION,
    (_, payload: ProviderConnectionTestPayload): Promise<IpcResult<string>> => {
      return new Promise((resolve) => {
        const fallbackTimer = setTimeout(() => {
          resolve({ success: false, error: 'Connection test timed out' })
        }, 20000)

        doTestConnection(payload)
          .then((result) => {
            resolve(result)
          })
          .catch(() => {
            resolve({ success: false, error: 'Connection failed' })
          })
          .finally(() => clearTimeout(fallbackTimer))
      })
    },
  )
}

async function doTestConnection(
  payload: ProviderConnectionTestPayload,
): Promise<IpcResult<string>> {
  const controller = new AbortController()
  const timerId = setTimeout(() => controller.abort(), 15000)

  try {
    const settings: ApiSettings = {
      provider: payload.type,
      apiKey: payload.apiKey,
      baseUrl: payload.baseUrl,
      model: payload.modelName,
      temperature: 0,
      maxCompletionTokens: 1,
      topP: 1,
      systemPrompt: '',
    }

    const client = createAIClient(settings)

    const stream = await client.chat.completions.create(
      {
        model: payload.modelName,
        messages: [{ role: 'user', content: 'Hi' }],
        max_completion_tokens: 1,
        stream: true,
      },
      { signal: controller.signal },
    )

    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _chunk of stream) {
        break
      }
    } catch {
      // Stream read error is irrelevant — create() succeeding already proved the connection
    }

    return { success: true, data: 'Connection successful!' }
  } catch (e) {
    if (controller.signal.aborted) {
      return { success: false, error: 'Connection timed out (15s)' }
    }
    const message = e instanceof Error ? e.message : String(e)
    return { success: false, error: message || 'Connection failed' }
  } finally {
    clearTimeout(timerId)
  }
}
