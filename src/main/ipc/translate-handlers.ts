import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type { TranslateRequestPayload, IpcResult, ApiSettings } from '@shared/types'
import { ERROR_CODES } from '@shared/errors'
import { AppError, toLocalizedError } from '../errors'
import { streamChat } from '../ai'
import { getProvider } from '../db/providers'
import { getModel } from '../db/models'

let activeController: AbortController | null = null

function loadTranslateSettings(providerId?: string, modelId?: string): ApiSettings {
  if (!providerId) {
    throw new AppError(ERROR_CODES.TRANSLATE_NO_PROVIDER)
  }

  const provider = getProvider(providerId)
  if (!provider) {
    throw new AppError(ERROR_CODES.TRANSLATE_PROVIDER_NOT_FOUND)
  }
  if (!provider.apiKey) {
    throw new AppError(ERROR_CODES.TRANSLATE_API_KEY_MISSING, { providerName: provider.name })
  }

  // Resolve model: specified modelId only
  if (!modelId) {
    throw new AppError(ERROR_CODES.TRANSLATE_NO_MODEL)
  }

  const model = getModel(modelId)
  if (!model || model.providerId !== providerId) {
    throw new AppError(ERROR_CODES.TRANSLATE_MODEL_INVALID, { providerName: provider.name })
  }

  const modelName = model.name

  return {
    provider: provider.type,
    apiKey: provider.apiKey,
    baseUrl: provider.baseUrl,
    model: modelName,
    temperature: 0.3,
    maxCompletionTokens: 4096,
    topP: 1,
    systemPrompt: '',
  }
}

const DEFAULT_TRANSLATE_PROMPT =
  'You are a professional translator. Translate the following text{source} to {target}. ' +
  'Only output the translation, nothing else. Preserve the original formatting.'

function buildSystemPrompt(
  customPrompt: string | undefined,
  sourceLang: string,
  targetLang: string,
): string {
  const sourcePart = sourceLang === 'auto' ? '' : ` from ${sourceLang}`
  const template = customPrompt?.trim() || DEFAULT_TRANSLATE_PROMPT
  // Support {source} and {target} placeholders in custom prompts
  return template.replace('{source}', sourcePart).replace('{target}', targetLang)
}

export function registerTranslateHandlers(): void {
  ipcMain.handle(
    IpcChannels.TRANSLATE_REQUEST,
    async (
      event: IpcMainInvokeEvent,
      payload: TranslateRequestPayload,
    ): Promise<IpcResult<void>> => {
      const { text, sourceLang, targetLang, providerId, modelId, systemPrompt, temperature } =
        payload
      const sender = event.sender
      let fullText = ''

      try {
        const settings = loadTranslateSettings(providerId, modelId)
        const controller = new AbortController()
        activeController = controller

        const prompt = buildSystemPrompt(systemPrompt, sourceLang, targetLang)

        await streamChat(
          {
            settings: { ...settings, temperature: temperature ?? 0.3 },
            messages: [
              { role: 'system', content: prompt },
              { role: 'user', content: text },
            ],
            signal: controller.signal,
          },
          {
            onChunk: (delta) => {
              fullText += delta
              if (!sender.isDestroyed()) {
                sender.send(IpcChannels.TRANSLATE_CHUNK, { delta })
              }
            },
          },
        )

        if (!sender.isDestroyed()) {
          sender.send(IpcChannels.TRANSLATE_END, { fullText })
        }
        activeController = null
        return { success: true }
      } catch (error: unknown) {
        activeController = null

        const isAborted =
          error instanceof Error &&
          (error.name === 'AbortError' || error.name === 'APIUserAbortError')
        if (isAborted) {
          if (!sender.isDestroyed()) {
            sender.send(IpcChannels.TRANSLATE_END, { fullText })
          }
          return { success: true }
        }

        const localized = toLocalizedError(error)
        if (!sender.isDestroyed()) {
          sender.send(IpcChannels.TRANSLATE_ERROR, { error: localized })
        }
        return { success: false, error: localized }
      }
    },
  )

  ipcMain.handle(IpcChannels.TRANSLATE_STOP, async (): Promise<IpcResult<void>> => {
    if (activeController) {
      activeController.abort()
      activeController = null
    }
    return { success: true }
  })
}
