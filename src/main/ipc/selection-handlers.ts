import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { IpcChannels } from '@shared/ipc-channels'
import type { SelectionRequestPayload, IpcResult, ApiSettings } from '@shared/types'
import { streamChat } from '../ai'
import { getProvider } from '../db/providers'
import { listModelsByProvider } from '../db/models'
import { getSelectionAction } from '../db/selection-actions'
import { getSetting } from '../db/settings'

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
    throw new Error('划词助手尚未配置模型。请打开设置 → 划词助手，选择独立的服务商和模型。')
  }

  const provider = getProvider(resolvedProviderId)
  if (!provider) {
    throw new Error('划词助手当前选择的服务商不存在，请在设置 → 划词助手 中重新选择。')
  }
  if (!provider.apiKey) {
    throw new Error(`服务商 "${provider.name}" 尚未配置 API Key，请到服务商设置中填写。`)
  }

  const resolvedModelId = modelId || getSetting('selection.modelId')
  if (!resolvedModelId) {
    throw new Error('划词助手尚未选择模型。请打开设置 → 划词助手，挑选一个模型。')
  }

  const model = listModelsByProvider(resolvedProviderId).find((m) => m.name === resolvedModelId)
  if (!model) {
    throw new Error(`模型在服务商 "${provider.name}" 下已不可用，请到设置 → 划词助手 重新选择。`)
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
          throw new Error('Selection action not found.')
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

        const userMessage: ChatCompletionMessageParam = { role: 'user', content: text }

        await streamChat(
          {
            settings,
            messages: [
              { role: 'system', content: systemPromptOverride || action.systemPrompt },
              userMessage,
            ],
            signal: controller.signal,
          },
          {
            onChunk: (delta) => {
              fullText += delta
              if (!isCurrent()) return
              if (!sender.isDestroyed()) {
                sender.send(IpcChannels.SELECTION_CHUNK, { delta })
              }
            },
          },
        )

        if (isCurrent() && !sender.isDestroyed()) {
          sender.send(IpcChannels.SELECTION_END, { fullText })
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
            sender.send(IpcChannels.SELECTION_END, { fullText })
          }
          return { success: true }
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        if (isCurrent() && !sender.isDestroyed()) {
          sender.send(IpcChannels.SELECTION_ERROR, { error: errorMessage })
        }
        return { success: false, error: errorMessage }
      }
    },
  )

  ipcMain.handle(IpcChannels.SELECTION_STOP, async (): Promise<IpcResult<void>> => {
    abortSelectionRequest()
    return { success: true }
  })
}
