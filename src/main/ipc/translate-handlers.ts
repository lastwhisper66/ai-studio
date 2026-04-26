import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type { TranslateRequestPayload, IpcResult, ApiSettings } from '@shared/types'
import { ERROR_CODES } from '@shared/errors'
import { AppError, toLocalizedError } from '../errors'
import { streamChat } from '../ai'
import { showCompletionNotification } from '../utils/notification'
import { getProvider } from '../db/providers'
import { getModel } from '../db/models'

let activeController: AbortController | null = null
let activeRequestId: number | null = null

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
  'You are a professional translator. Translate the input text{source} into {target}. ' +
  'If the input is already in {target}, output it unchanged. ' +
  'Only output the translation, nothing else. Preserve the original formatting and tone.'

function buildSystemPrompt(
  customPrompt: string | undefined,
  sourceLang: string,
  targetLang: string,
): string {
  const sourcePart = sourceLang === 'auto' ? '' : ` from ${sourceLang}`
  const template = customPrompt?.trim() || DEFAULT_TRANSLATE_PROMPT
  // Support {source} and {target} placeholders in custom prompts
  return template.replaceAll('{source}', sourcePart).replaceAll('{target}', targetLang)
}

export function registerTranslateHandlers(): void {
  ipcMain.handle(
    IpcChannels.TRANSLATE_REQUEST,
    async (
      event: IpcMainInvokeEvent,
      payload: TranslateRequestPayload,
    ): Promise<IpcResult<void>> => {
      const {
        requestId,
        text,
        sourceLang,
        targetLang,
        providerId,
        modelId,
        systemPrompt,
        temperature,
      } = payload
      const sender = event.sender
      let fullText = ''
      let controller: AbortController | null = null

      try {
        const settings = loadTranslateSettings(providerId, modelId)

        if (activeController) {
          activeController.abort()
          activeController = null
        }

        controller = new AbortController()
        activeController = controller
        activeRequestId = requestId

        const prompt = buildSystemPrompt(systemPrompt, sourceLang, targetLang)

        const isStillActive = (): boolean =>
          activeController === controller && activeRequestId === requestId

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
              if (isStillActive() && !sender.isDestroyed()) {
                sender.send(IpcChannels.TRANSLATE_CHUNK, { requestId, delta })
              }
            },
          },
        )

        const stillActive = isStillActive()
        if (stillActive) {
          activeController = null
          activeRequestId = null
        }

        if (stillActive && !sender.isDestroyed()) {
          sender.send(IpcChannels.TRANSLATE_END, { requestId, fullText })
          showCompletionNotification('translate')
        }
        return { success: true }
      } catch (error: unknown) {
        // If a newer request replaced us, silently discard — the new stream owns the UI now
        const stillActive = activeController === controller && activeRequestId === requestId
        if (stillActive) {
          activeController = null
          activeRequestId = null
        }

        const isAborted =
          error instanceof Error &&
          (error.name === 'AbortError' || error.name === 'APIUserAbortError')
        if (isAborted) {
          if (stillActive && !sender.isDestroyed()) {
            sender.send(IpcChannels.TRANSLATE_END, { requestId, fullText })
          }
          return { success: true }
        }

        const localized = toLocalizedError(error)
        if (stillActive && !sender.isDestroyed()) {
          sender.send(IpcChannels.TRANSLATE_ERROR, { requestId, error: localized })
        }
        return { success: false, error: localized }
      }
    },
  )

  ipcMain.handle(IpcChannels.TRANSLATE_STOP, async (): Promise<IpcResult<void>> => {
    if (activeController) {
      activeController.abort()
      activeController = null
      activeRequestId = null
    }
    return { success: true }
  })
}
