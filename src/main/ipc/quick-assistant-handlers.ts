import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type { QuickActionRequestPayload, IpcResult, ApiSettings } from '@shared/types'
import { streamChat } from '../ai'
import { getProvider } from '../db/providers'
import { listModelsByProvider } from '../db/models'
import { getQuickAction } from '../db/quick-actions'
import { getSetting } from '../db/settings'

let activeController: AbortController | null = null

function loadQuickAssistantSettings(providerId?: string, modelId?: string): ApiSettings {
  const resolvedProviderId = providerId || getSetting('quickAssistant.providerId')
  if (!resolvedProviderId) {
    throw new Error(
      'No provider configured for Quick Assistant. Please select a model in settings.',
    )
  }

  const provider = getProvider(resolvedProviderId)
  if (!provider) {
    throw new Error('Selected provider not found.')
  }
  if (!provider.apiKey) {
    throw new Error(`API key is not configured for provider "${provider.name}".`)
  }

  const resolvedModelId = modelId || getSetting('quickAssistant.modelId')
  if (!resolvedModelId) {
    throw new Error('No model configured for Quick Assistant. Please select a model in settings.')
  }

  const model = listModelsByProvider(resolvedProviderId).find((m) => m.name === resolvedModelId)
  if (!model) {
    throw new Error(`Selected model is invalid for provider "${provider.name}".`)
  }

  return {
    provider: provider.type,
    apiKey: provider.apiKey,
    baseUrl: provider.baseUrl,
    model: model.name,
    temperature: 0.7,
    maxCompletionTokens: 4096,
    topP: 1,
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
      const { text, actionId, providerId, modelId, systemPromptOverride } = payload
      const sender = event.sender
      let fullText = ''

      try {
        const action = getQuickAction(actionId)
        if (!action) {
          throw new Error('Quick action not found.')
        }

        const settings = loadQuickAssistantSettings(providerId, modelId)

        // Abort any in-flight request before starting a new one
        if (activeController) {
          activeController.abort()
          activeController = null
        }

        const controller = new AbortController()
        activeController = controller

        await streamChat(
          {
            settings,
            messages: [
              { role: 'system', content: systemPromptOverride || action.systemPrompt },
              { role: 'user', content: text },
            ],
            signal: controller.signal,
          },
          {
            onChunk: (delta) => {
              fullText += delta
              if (!sender.isDestroyed()) {
                sender.send(IpcChannels.QUICK_ASSISTANT_CHUNK, { delta })
              }
            },
          },
        )

        if (!sender.isDestroyed()) {
          sender.send(IpcChannels.QUICK_ASSISTANT_END, { fullText })
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
            sender.send(IpcChannels.QUICK_ASSISTANT_END, { fullText })
          }
          return { success: true }
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        if (!sender.isDestroyed()) {
          sender.send(IpcChannels.QUICK_ASSISTANT_ERROR, { error: errorMessage })
        }
        return { success: false, error: errorMessage }
      }
    },
  )

  ipcMain.handle(IpcChannels.QUICK_ASSISTANT_STOP, async (): Promise<IpcResult<void>> => {
    abortQuickAssistant()
    return { success: true }
  })
}
