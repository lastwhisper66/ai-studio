import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import type {
  ChatCompletionContentPart,
  ChatCompletionMessageParam,
} from 'openai/resources/chat/completions'
import { IpcChannels } from '@shared/ipc-channels'
import type { QuickActionRequestPayload, IpcResult, ApiSettings, FileData } from '@shared/types'
import { isImageMime } from '@shared/types'
import { ERROR_CODES } from '@shared/errors'
import { AppError, toLocalizedError } from '../errors'
import { streamChat } from '../ai'
import { getProvider } from '../db/providers'
import { listModelsByProvider } from '../db/models'
import { getQuickAction } from '../db/quick-actions'
import { getSetting } from '../db/settings'
import { stripTranslateInputTags } from '../utils/strip-translate-tags'

let activeController: AbortController | null = null

export function abortActiveQuickAssistantStream(): void {
  if (activeController) {
    try {
      activeController.abort()
    } catch {
      // ignore
    }
    activeController = null
  }
}

function loadQuickAssistantSettings(providerId?: string, modelId?: string): ApiSettings {
  const resolvedProviderId = providerId || getSetting('quickAssistant.providerId')
  if (!resolvedProviderId) {
    throw new AppError(ERROR_CODES.QUICK_NO_PROVIDER)
  }

  const provider = getProvider(resolvedProviderId)
  if (!provider) {
    throw new AppError(ERROR_CODES.QUICK_PROVIDER_NOT_FOUND)
  }
  if (!provider.apiKey) {
    throw new AppError(ERROR_CODES.QUICK_API_KEY_MISSING, { providerName: provider.name })
  }

  const resolvedModelId = modelId || getSetting('quickAssistant.modelId')
  if (!resolvedModelId) {
    throw new AppError(ERROR_CODES.QUICK_NO_MODEL)
  }

  const model = listModelsByProvider(resolvedProviderId).find((m) => m.name === resolvedModelId)
  if (!model) {
    throw new AppError(ERROR_CODES.QUICK_MODEL_INVALID, { providerName: provider.name })
  }

  return {
    provider: provider.type,
    apiKey: provider.apiKey,
    baseUrl: provider.baseUrl,
    model: model.name,
    // temperature / maxCompletionTokens / topP intentionally omitted so the
    // model / provider SDK uses its own defaults. Quick Assistant is meant to
    // be a low-friction surface; advanced sampling lives in Assistant settings.
    systemPrompt: '',
  }
}

export function abortQuickAssistant(): void {
  if (activeController) {
    activeController.abort()
    activeController = null
  }
}

export function registerQuickAssistantHandlers(): void {
  ipcMain.handle(
    IpcChannels.QUICK_ASSISTANT_REQUEST,
    async (
      event: IpcMainInvokeEvent,
      payload: QuickActionRequestPayload,
    ): Promise<IpcResult<void>> => {
      const { text, actionId, providerId, modelId, systemPromptOverride, files } = payload
      const sender = event.sender
      let fullText = ''

      try {
        const action = getQuickAction(actionId)
        if (!action) {
          throw new AppError(ERROR_CODES.QUICK_ACTION_NOT_FOUND)
        }

        const settings = loadQuickAssistantSettings(providerId, modelId)

        // Abort any in-flight request before starting a new one
        if (activeController) {
          activeController.abort()
          activeController = null
        }

        const controller = new AbortController()
        activeController = controller

        // Build user message — multimodal if images are attached
        const isTranslateAction =
          actionId === 'builtin-translate' || actionId === 'builtin-image-translate'
        const wrapText = (t: string): string =>
          isTranslateAction ? `<translate_input>\n${t}\n</translate_input>` : t
        const imageFiles = (files ?? []).filter((f: FileData) => isImageMime(f.mimeType))
        let userMessage: ChatCompletionMessageParam
        if (imageFiles.length > 0) {
          const parts: ChatCompletionContentPart[] = []
          if (text) {
            parts.push({ type: 'text', text: wrapText(text) })
          }
          for (const file of imageFiles) {
            parts.push({
              type: 'image_url',
              image_url: { url: `data:${file.mimeType};base64,${file.base64}` },
            })
          }
          userMessage = { role: 'user', content: parts }
        } else {
          userMessage = { role: 'user', content: wrapText(text) }
        }

        const baseSystemPrompt = systemPromptOverride ?? action.systemPrompt
        const systemPrompt = isTranslateAction
          ? `${baseSystemPrompt}\n- NEVER include <translate_input> or </translate_input> tags in your output.`
          : baseSystemPrompt

        await streamChat(
          {
            settings,
            messages: [{ role: 'system', content: systemPrompt }, userMessage],
            signal: controller.signal,
          },
          {
            onChunk: (delta, isReasoning) => {
              if (isReasoning) return
              fullText += delta
              if (!sender.isDestroyed()) {
                sender.send(IpcChannels.QUICK_ASSISTANT_CHUNK, { delta })
              }
            },
          },
        )

        if (!sender.isDestroyed()) {
          const result = isTranslateAction ? stripTranslateInputTags(fullText) : fullText
          sender.send(IpcChannels.QUICK_ASSISTANT_END, { fullText: result })
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
            sender.send(IpcChannels.QUICK_ASSISTANT_END, {
              fullText: stripTranslateInputTags(fullText),
            })
          }
          return { success: true }
        }

        const localized = toLocalizedError(error)
        if (!sender.isDestroyed()) {
          sender.send(IpcChannels.QUICK_ASSISTANT_ERROR, { error: localized })
        }
        return { success: false, error: localized }
      }
    },
  )

  ipcMain.handle(IpcChannels.QUICK_ASSISTANT_STOP, async (): Promise<IpcResult<void>> => {
    abortQuickAssistant()
    return { success: true }
  })
}
