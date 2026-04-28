import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type { IpcResult, Skill, CreateSkillPayload, UpdateSkillPayload } from '@shared/types'
import { toLocalizedError } from '../errors'
import { listSkills, getSkill, createSkill, updateSkill, deleteSkill, reorderSkills } from '../db'

export function registerSkillHandlers(): void {
  ipcMain.handle(IpcChannels.SKILL_LIST, (): IpcResult<Skill[]> => {
    try {
      const data = listSkills()
      return { success: true, data }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(IpcChannels.SKILL_GET, (_, id: string): IpcResult<Skill | undefined> => {
    try {
      const data = getSkill(id)
      return { success: true, data }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(IpcChannels.SKILL_CREATE, (_, data: CreateSkillPayload): IpcResult<Skill> => {
    try {
      const skill = createSkill(data)
      return { success: true, data: skill }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(
    IpcChannels.SKILL_UPDATE,
    (_, id: string, data: UpdateSkillPayload): IpcResult<Skill | undefined> => {
      try {
        const skill = updateSkill(id, data)
        return { success: true, data: skill }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(IpcChannels.SKILL_DELETE, (_, id: string): IpcResult<void> => {
    try {
      deleteSkill(id)
      return { success: true }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(IpcChannels.SKILL_REORDER, (_, ids: string[]): IpcResult<void> => {
    try {
      reorderSkills(ids)
      return { success: true }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })
}
