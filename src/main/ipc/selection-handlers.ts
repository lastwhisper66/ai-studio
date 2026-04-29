import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { IpcChannels } from '@shared/ipc-channels'
import type { SelectionRequestPayload, IpcResult, ApiSettings } from '@shared/types'
import { ERROR_CODES } from '@shared/errors'
import { AppError, toLocalizedError } from '../errors'
import { streamChat } from '../ai'
import { getProvider } from '../db/providers'
import { listModelsByProvider } from '../db/models'
import { getSelectionAction } from '../db/selection-actions'
import { getSetting } from '../db/settings'
import { stripTranslateInputTags } from '../utils/strip-translate-tags'

let activeController: AbortController | null = null
/**
 * Monotonic request sequence — bumped on every new request and on abort.
 * An in-flight request captures its own seq; stream events (chunk/end/error)
 * are suppressed unless the seq still matches `activeRequestSeq`. This
 * prevents a just-aborted stream from leaking a premature `end`/`error`
 * onto the fresh request that replaced it (they share the same webContents).
 */
let activeRequestSeq = 0

/**
 * Load settings for the selection assistant. Selection assistant keeps its
 * own provider/model config (`selection.providerId` / `selection.modelId`);
 * there is no fallback to Quick Assistant — the user must pick explicitly.
 */
function loadSelectionSettings(providerId?: string, modelId?: string): ApiSettings {
  const resolvedProviderId = providerId || getSetting('selection.providerId')
  if (!resolvedProviderId) {
    throw new AppError(ERROR_CODES.SELECTION_NO_MODEL)
  }

  const provider = getProvider(resolvedProviderId)
  if (!provider) {
    throw new AppError(ERROR_CODES.SELECTION_PROVIDER_NOT_FOUND)
  }
  if (!provider.apiKey) {
    throw new AppError(ERROR_CODES.SELECTION_API_KEY_MISSING, { providerName: provider.name })
  }

  const resolvedModelId = modelId || getSetting('selection.modelId')
  if (!resolvedModelId) {
    throw new AppError(ERROR_CODES.SELECTION_NO_MODEL_SELECTED)
  }

  const model = listModelsByProvider(resolvedProviderId).find((m) => m.name === resolvedModelId)
  if (!model) {
    throw new AppError(ERROR_CODES.SELECTION_MODEL_UNAVAILABLE, { providerName: provider.name })
  }

  return {
    provider: provider.type,
    apiKey: provider.apiKey,
    baseUrl: provider.baseUrl,
    model: model.name,
    // Selection Assistant defers sampling to the model's defaults — the UI
    // doesn't expose temperature/max_tokens/top_p knobs here.
    systemPrompt: '',
  }
}

export function abortSelectionRequest(): void {
  if (activeController) {
    activeController.abort()
    activeController = null
  }
  // Invalidate any in-flight request so its late-arriving events get dropped.
  activeRequestSeq++
}

export function registerSelectionHandlers(): void {
  ipcMain.handle(
    IpcChannels.SELECTION_REQUEST,
    async (
      event: IpcMainInvokeEvent,
      payload: SelectionRequestPayload,
    ): Promise<IpcResult<void>> => {
      const { text, actionId, providerId, modelId, systemPromptOverride } = payload
      const sender = event.sender
      let fullText = ''

      // Claim this request seq; any subsequent abort/request will bump it
      // past us and our emissions below will self-suppress.
      const mySeq = ++activeRequestSeq
      const isCurrent = (): boolean => mySeq === activeRequestSeq

      try {
        const action = getSelectionAction(actionId)
        if (!action) {
          throw new AppError(ERROR_CODES.SELECTION_ACTION_NOT_FOUND)
        }

        const settings = loadSelectionSettings(providerId, modelId)

        // Abort any in-flight request before starting a new one.
        // NOTE: we don't call activeRequestSeq++ here because we already
        // bumped it above for `mySeq` — the old request's emissions are
        // already invalidated.
        if (activeController) {
          activeController.abort()
        }

        const controller = new AbortController()
        activeController = controller

        const isTranslateAction = actionId === 'builtin-sel-translate'
        const wrappedText = isTranslateAction
          ? `<translate_input>\n${text}\n</translate_input>`
          : text
        const userMessage: ChatCompletionMessageParam = { role: 'user', content: wrappedText }

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
              if (!isCurrent()) return
              if (!sender.isDestroyed()) {
                sender.send(IpcChannels.SELECTION_CHUNK, { delta })
              }
            },
          },
        )

        if (isCurrent() && !sender.isDestroyed()) {
          const result = isTranslateAction ? stripTranslateInputTags(fullText) : fullText
          sender.send(IpcChannels.SELECTION_END, { fullText: result })
        }
        if (isCurrent()) activeController = null
        return { success: true }
      } catch (error: unknown) {
        if (isCurrent()) activeController = null

        const isAborted =
          error instanceof Error &&
          (error.name === 'AbortError' || error.name === 'APIUserAbortError')
        if (isAborted) {
          if (isCurrent() && !sender.isDestroyed()) {
            sender.send(IpcChannels.SELECTION_END, {
              fullText: stripTranslateInputTags(fullText),
            })
          }
          return { success: true }
        }

        const localized = toLocalizedError(error)
        if (isCurrent() && !sender.isDestroyed()) {
          sender.send(IpcChannels.SELECTION_ERROR, { error: localized })
        }
        return { success: false, error: localized }
      }
    },
  )

  ipcMain.handle(IpcChannels.SELECTION_STOP, async (): Promise<IpcResult<void>> => {
    abortSelectionRequest()
    return { success: true }
  })
}
