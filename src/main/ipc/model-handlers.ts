import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type { IpcResult, Model, ApiSettings, RemoteModelFetchPayload } from '@shared/types'
import { ERROR_CODES } from '@shared/errors'
import { toLocalizedError } from '../errors'
import {
  listAllModels,
  createModel,
  updateModel,
  deleteModel,
  deleteModelsByProvider,
  reorderModels,
} from '../db'
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
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(IpcChannels.MODEL_CREATE, (_, data: CreateModelData): IpcResult<Model> => {
    try {
      const model = createModel(data)
      return { success: true, data: model }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(
    IpcChannels.MODEL_UPDATE,
    (_, id: string, data: UpdateModelData): IpcResult<Model | undefined> => {
      try {
        const model = updateModel(id, data)
        return { success: true, data: model }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(IpcChannels.MODEL_DELETE, (_, id: string): IpcResult<void> => {
    try {
      deleteModel(id)
      return { success: true }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(IpcChannels.MODEL_DELETE_BY_PROVIDER, (_, providerId: string): IpcResult<void> => {
    try {
      deleteModelsByProvider(providerId)
      return { success: true }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(IpcChannels.MODEL_REORDER, (_, ids: string[]): IpcResult<void> => {
    try {
      reorderModels(ids)
      return { success: true }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  /** Fetch models from a remote provider via GET /v1/models */
  ipcMain.handle(
    IpcChannels.MODEL_FETCH_REMOTE,
    async (_, payload: RemoteModelFetchPayload): Promise<IpcResult<RemoteModel[]>> => {
      try {
        return await doFetchRemoteModels(payload)
      } catch {
        return { success: false, error: { code: ERROR_CODES.MODEL_FETCH_FAILED } }
      }
    },
  )
}

async function doFetchRemoteModels(
  payload: RemoteModelFetchPayload,
): Promise<IpcResult<RemoteModel[]>> {
  const controller = new AbortController()
  const timerId = setTimeout(() => controller.abort(), 15000)

  try {
    applySslSetting()

    const settings: ApiSettings = {
      provider: payload.type,
      apiKey: payload.apiKey,
      baseUrl: payload.baseUrl,
      model: 'placeholder-model',
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
      return { success: false, error: { code: ERROR_CODES.MODEL_FETCH_TIMEOUT } }
    }
    return { success: false, error: toLocalizedError(e) }
  } finally {
    clearTimeout(timerId)
  }
}
