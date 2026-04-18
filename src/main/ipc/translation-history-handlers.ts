import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type { IpcResult, TranslationHistoryItem } from '@shared/types'
import { toLocalizedError } from '../errors'
import {
  listTranslationHistory,
  createTranslationHistory,
  clearTranslationHistory,
} from '../db/translation-history'

export function registerTranslationHistoryHandlers(): void {
  ipcMain.handle(
    IpcChannels.TRANSLATION_HISTORY_LIST,
    async (): Promise<IpcResult<TranslationHistoryItem[]>> => {
      try {
        return { success: true, data: listTranslationHistory() }
      } catch (error) {
        return { success: false, error: toLocalizedError(error) }
      }
    },
  )

  ipcMain.handle(
    IpcChannels.TRANSLATION_HISTORY_CREATE,
    async (
      _event,
      sourceText: string,
      translatedText: string,
      sourceLang: string,
      targetLang: string,
    ): Promise<IpcResult<TranslationHistoryItem>> => {
      try {
        const item = createTranslationHistory(sourceText, translatedText, sourceLang, targetLang)
        return { success: true, data: item }
      } catch (error) {
        return { success: false, error: toLocalizedError(error) }
      }
    },
  )

  ipcMain.handle(IpcChannels.TRANSLATION_HISTORY_CLEAR, async (): Promise<IpcResult<void>> => {
    try {
      clearTranslationHistory()
      return { success: true }
    } catch (error) {
      return { success: false, error: toLocalizedError(error) }
    }
  })
}
