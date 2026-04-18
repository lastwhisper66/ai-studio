import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type { Phrase, IpcResult } from '@shared/types'
import { toLocalizedError } from '../errors'
import { listPhrases, createPhrase, updatePhrase, deletePhrase } from '../db'

export function registerPhraseHandlers(): void {
  ipcMain.handle(IpcChannels.PHRASE_LIST, (): IpcResult<Phrase[]> => {
    try {
      return { success: true, data: listPhrases() }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(
    IpcChannels.PHRASE_CREATE,
    (_, title: string, content: string): IpcResult<Phrase> => {
      try {
        return { success: true, data: createPhrase(title, content) }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(
    IpcChannels.PHRASE_UPDATE,
    (
      _,
      id: string,
      data: Partial<Pick<Phrase, 'title' | 'content'>>,
    ): IpcResult<Phrase | undefined> => {
      try {
        return { success: true, data: updatePhrase(id, data) }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(IpcChannels.PHRASE_DELETE, (_, id: string): IpcResult<void> => {
    try {
      deletePhrase(id)
      return { success: true }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })
}
