import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type { IpcResult, Model, Provider, ApiSettings } from '@shared/types'
import { listAllModels, createModel, updateModel, deleteModel } from '../db'
import type { CreateModelData, UpdateModelData } from '../db/models'
import { createAIClient, applySslSetting } from '../ai'

/** Simple remote model entry returned by GET /v1/models */
interface RemoteModel {
  id: string
  owned_by?: string
}

export function registerModelHandlers(): void {
  ipcMain.handle(IpcChannels.MODEL_LIST, (): IpcResult<Model[]> => {
    try {
      const data = listAllModels()
      return { success: true, data }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.MODEL_CREATE, (_, data: CreateModelData): IpcResult<Model> => {
    try {
      const model = createModel(data)
      return { success: true, data: model }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(
    IpcChannels.MODEL_UPDATE,
    (_, id: string, data: UpdateModelData): IpcResult<Model | undefined> => {
      try {
        const model = updateModel(id, data)
        return { success: true, data: model }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    },
  )

  ipcMain.handle(IpcChannels.MODEL_DELETE, (_, id: string): IpcResult<void> => {
    try {
      deleteModel(id)
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  /** Fetch models from a remote provider via GET /v1/models */
  ipcMain.handle(
    IpcChannels.MODEL_FETCH_REMOTE,
    async (_, provider: Provider): Promise<IpcResult<RemoteModel[]>> => {
      try {
        return await doFetchRemoteModels(provider)
      } catch {
        return { success: false, error: 'Failed to fetch models' }
      }
    },
  )
}

async function doFetchRemoteModels(provider: Provider): Promise<IpcResult<RemoteModel[]>> {
  const controller = new AbortController()
  const timerId = setTimeout(() => controller.abort(), 15000)

  try {
    applySslSetting()

    const settings: ApiSettings = {
      provider: provider.type,
      apiKey: provider.apiKey,
      baseUrl: provider.baseUrl,
      endpoint: provider.endpoint,
      apiVersion: provider.apiVersion,
      deploymentName: provider.deploymentName,
      model: provider.model || 'gpt-3.5-turbo',
      temperature: 0,
      maxCompletionTokens: 1,
      topP: 1,
      systemPrompt: '',
    }

    const client = createAIClient(settings)

    // Use OpenAI SDK's models.list() which calls GET /v1/models
    const response = await client.models.list({ signal: controller.signal })

    const models: RemoteModel[] = response.data.map((m) => ({
      id: m.id,
      owned_by: m.owned_by,
    }))

    return { success: true, data: models }
  } catch (e) {
    if (controller.signal.aborted) {
      return { success: false, error: 'Fetch models timed out (15s)' }
    }
    const message = e instanceof Error ? e.message : String(e)
    return { success: false, error: message || 'Failed to fetch models' }
  } finally {
    clearTimeout(timerId)
  }
}
