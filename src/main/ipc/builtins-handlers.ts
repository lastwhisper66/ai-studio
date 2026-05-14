import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type { BuiltinCategory, BuiltinUpdatesStatus, IpcResult } from '@shared/types'
import { toLocalizedError } from '../errors'
import {
  BUILTIN_TEMPLATES_VERSION,
  BUILTIN_QUICK_ACTIONS_VERSION,
  BUILTIN_SELECTION_ACTIONS_VERSION,
} from '../builtins'
import { getSetting, setSetting } from '../db/settings'
import { applyDefaultAssistantUpdate } from '../db/assistants'
import { applyBuiltinTemplatesUpdate } from '../db/templates'
import { applyBuiltinQuickActionsUpdate } from '../db/quick-actions'
import { applyBuiltinSelectionActionsUpdate } from '../db/selection-actions'

function readAppliedVersion(key: string, fallback: number): number {
  const v = getSetting(key)
  if (v === undefined) return fallback
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function computeStatus(): BuiltinUpdatesStatus {
  const tApplied = readAppliedVersion(
    'builtins.templates.appliedVersion',
    BUILTIN_TEMPLATES_VERSION,
  )
  const qApplied = readAppliedVersion(
    'builtins.quickActions.appliedVersion',
    BUILTIN_QUICK_ACTIONS_VERSION,
  )
  const sApplied = readAppliedVersion(
    'builtins.selectionActions.appliedVersion',
    BUILTIN_SELECTION_ACTIONS_VERSION,
  )
  return {
    templates: {
      hasUpdate: BUILTIN_TEMPLATES_VERSION > tApplied,
      currentVersion: BUILTIN_TEMPLATES_VERSION,
      appliedVersion: tApplied,
    },
    quickActions: {
      hasUpdate: BUILTIN_QUICK_ACTIONS_VERSION > qApplied,
      currentVersion: BUILTIN_QUICK_ACTIONS_VERSION,
      appliedVersion: qApplied,
    },
    selectionActions: {
      hasUpdate: BUILTIN_SELECTION_ACTIONS_VERSION > sApplied,
      currentVersion: BUILTIN_SELECTION_ACTIONS_VERSION,
      appliedVersion: sApplied,
    },
  }
}

export function registerBuiltinsHandlers(): void {
  ipcMain.handle(IpcChannels.BUILTINS_GET_UPDATES_STATUS, (): IpcResult<BuiltinUpdatesStatus> => {
    try {
      return { success: true, data: computeStatus() }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(
    IpcChannels.BUILTINS_APPLY_UPDATE,
    (_, category: BuiltinCategory): IpcResult<void> => {
      try {
        switch (category) {
          case 'templates':
            applyBuiltinTemplatesUpdate()
            applyDefaultAssistantUpdate()
            setSetting('builtins.templates.appliedVersion', String(BUILTIN_TEMPLATES_VERSION))
            break
          case 'quickActions':
            applyBuiltinQuickActionsUpdate()
            setSetting(
              'builtins.quickActions.appliedVersion',
              String(BUILTIN_QUICK_ACTIONS_VERSION),
            )
            break
          case 'selectionActions':
            applyBuiltinSelectionActionsUpdate()
            setSetting(
              'builtins.selectionActions.appliedVersion',
              String(BUILTIN_SELECTION_ACTIONS_VERSION),
            )
            break
        }
        return { success: true }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )
}
