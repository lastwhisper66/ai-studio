import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type { IpcResult, Provider, ApiSettings } from '@shared/types'
import { listProviders, getProvider, createProvider, updateProvider, deleteProvider } from '../db'
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

  ipcMain.handle(
    IpcChannels.PROVIDER_TEST_CONNECTION,
    (_, provider: Provider): Promise<IpcResult<string>> => {
      console.log('[TestConnection] >>> handler called, provider:', provider.type, provider.name)
      return new Promise((resolve) => {
        const fallbackTimer = setTimeout(() => {
          console.log('[TestConnection] !!! hard timeout (20s) reached')
          resolve({ success: false, error: 'Connection test timed out' })
        }, 20000)

        doTestConnection(provider)
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

async function doTestConnection(provider: Provider): Promise<IpcResult<string>> {
  const controller = new AbortController()
  const timerId = setTimeout(() => controller.abort(), 15000)

  try {
    const settings: ApiSettings = {
      provider: provider.type,
      apiKey: provider.apiKey,
      baseUrl: provider.baseUrl,
      endpoint: provider.endpoint,
      apiVersion: provider.apiVersion,
      deploymentName: provider.deploymentName,
      model: provider.model,
      temperature: 0,
      maxCompletionTokens: 1,
      systemPrompt: '',
    }

    console.log('[TestConnection] creating client...')
    const client = createAIClient(settings)

    const model =
      provider.type === 'azure' ? provider.deploymentName || provider.model : provider.model

    console.log('[TestConnection] sending streaming request...')
    const stream = await client.chat.completions.create(
      {
        model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_completion_tokens: 1,
        stream: true,
      },
      { signal: controller.signal },
    )

    console.log('[TestConnection] stream created, consuming first chunk...')
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
