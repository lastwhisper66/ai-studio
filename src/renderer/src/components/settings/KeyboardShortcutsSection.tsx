import { useCallback, useState } from 'react'
import { RotateCcw, Lock, BrushCleaning } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_KEYBINDINGS, type KeybindingActionId } from '@shared/keybindings'
import { useKeybindingStore } from '@renderer/stores/keybindingStore'
import { ShortcutRecorder, ShortcutDisplay } from './ShortcutRecorder'
import { Button } from '@renderer/components/ui/button'
import { Switch } from '@renderer/components/ui/switch'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@renderer/components/ui/alert-dialog'

interface ConflictInfo {
  targetActionId: KeybindingActionId
  conflictActionId: KeybindingActionId
  accelerator: string
}

const CATEGORIES = ['app', 'chat', 'window'] as const

export function KeyboardShortcutsSection(): React.JSX.Element {
  const { t } = useTranslation()
  const overrides = useKeybindingStore((s) => s.overrides)
  const disabled = useKeybindingStore((s) => s.disabled)
  const getEffectiveAccelerator = useKeybindingStore((s) => s.getEffectiveAccelerator)
  const setOverride = useKeybindingStore((s) => s.setOverride)
  const clearAction = useKeybindingStore((s) => s.clearAction)
  const resetAction = useKeybindingStore((s) => s.resetAction)
  const resetAll = useKeybindingStore((s) => s.resetAll)
  const toggleDisabled = useKeybindingStore((s) => s.toggleDisabled)
  const [conflict, setConflict] = useState<ConflictInfo | null>(null)

  const handleChange = useCallback(
    (actionId: KeybindingActionId, accelerator: string) => {
      for (const id of Object.keys(DEFAULT_KEYBINDINGS) as KeybindingActionId[]) {
        if (id === actionId) continue
        const accel = getEffectiveAccelerator(id)
        if (accel && accel.toLowerCase() === accelerator.toLowerCase()) {
          setConflict({ targetActionId: actionId, conflictActionId: id, accelerator })
          return
        }
      }
      setOverride(actionId, accelerator)
    },
    [getEffectiveAccelerator, setOverride],
  )

  const handleConflictConfirm = useCallback(async () => {
    if (!conflict) return
    if (DEFAULT_KEYBINDINGS[conflict.conflictActionId].readOnly) {
      setConflict(null)
      return
    }
    await clearAction(conflict.conflictActionId)
    await setOverride(conflict.targetActionId, conflict.accelerator)
    setConflict(null)
  }, [conflict, clearAction, setOverride])

  const isActionDisabled = (actionId: KeybindingActionId): boolean => !!disabled[actionId]
  const isActionCleared = (actionId: KeybindingActionId): boolean => overrides[actionId] === ''
  const isActionOverridden = (actionId: KeybindingActionId): boolean => {
    const val = overrides[actionId]
    return val !== undefined && val !== ''
  }
  const isModified = (actionId: KeybindingActionId): boolean => {
    return isActionOverridden(actionId) || isActionCleared(actionId)
  }
  const getAccelerator = (actionId: KeybindingActionId): string => {
    const val = overrides[actionId]
    if (val === '') return ''
    return val ?? DEFAULT_KEYBINDINGS[actionId].defaultAccelerator
  }

  const entries = Object.entries(DEFAULT_KEYBINDINGS) as [
    KeybindingActionId,
    (typeof DEFAULT_KEYBINDINGS)[KeybindingActionId],
  ][]

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-card/50 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">{t('keybindings.title')}</h2>
            <p className="text-muted-foreground mt-1 text-sm">{t('keybindings.description')}</p>
          </div>
          <Button variant="outline" size="sm" onClick={resetAll}>
            <RotateCcw className="mr-1.5 size-3.5" />
            {t('keybindings.resetAll')}
          </Button>
        </div>
      </div>

      {CATEGORIES.map((category) => {
        const items = entries.filter(([, def]) => def.category === category)
        if (items.length === 0) return null
        return (
          <div key={category} className="rounded-xl border bg-card/50 p-5">
            <h3 className="text-sm font-semibold">{t(`keybindings.category.${category}`)}</h3>
            <div className="mt-4 space-y-3">
              {items.map(([actionId, def]) => {
                const actionDisabledVal = isActionDisabled(actionId)
                const actionClearedVal = isActionCleared(actionId)
                const accel = getAccelerator(actionId)
                const modified = isModified(actionId)

                return (
                  <div key={actionId} className="flex items-center justify-between gap-4">
                    <span
                      className={actionDisabledVal ? 'text-muted-foreground text-sm' : 'text-sm'}>
                      {t(def.labelKey)}
                    </span>
                    <div className="flex items-center gap-2">
                      {def.readOnly ? (
                        <div className="flex items-center gap-2">
                          <ShortcutDisplay accelerator={getAccelerator(actionId)} />
                          <Lock className="text-muted-foreground size-3.5" />
                        </div>
                      ) : (
                        <>
                          {actionClearedVal ? (
                            <div className="border-border bg-muted inline-flex h-[34px] min-w-[120px] items-center justify-center rounded-md border px-3">
                              <span className="text-muted-foreground text-xs">
                                {t('keybindings.noShortcut')}
                              </span>
                            </div>
                          ) : (
                            <ShortcutRecorder
                              value={accel}
                              onChange={(a) => handleChange(actionId, a)}
                              disabled={actionDisabledVal}
                            />
                          )}
                          <span title={t('keybindings.clear')}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              disabled={actionClearedVal}
                              onClick={() => clearAction(actionId)}>
                              <BrushCleaning className="size-3.5" />
                            </Button>
                          </span>
                          <span title={t('keybindings.reset')}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              disabled={!modified}
                              onClick={() => resetAction(actionId)}>
                              <RotateCcw className="size-3.5" />
                            </Button>
                          </span>
                          <Switch
                            checked={!actionDisabledVal}
                            onCheckedChange={() => toggleDisabled(actionId)}
                          />
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <AlertDialog open={!!conflict} onOpenChange={(open) => !open && setConflict(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('keybindings.conflictTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {conflict &&
                (DEFAULT_KEYBINDINGS[conflict.conflictActionId].readOnly
                  ? t('keybindings.conflictReadOnly', {
                      shortcut: conflict.accelerator,
                      action: t(DEFAULT_KEYBINDINGS[conflict.conflictActionId].labelKey),
                    })
                  : t('keybindings.conflictDescription', {
                      shortcut: conflict.accelerator,
                      action: t(DEFAULT_KEYBINDINGS[conflict.conflictActionId].labelKey),
                    }))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            {conflict && !DEFAULT_KEYBINDINGS[conflict.conflictActionId].readOnly && (
              <AlertDialogAction onClick={handleConflictConfirm}>
                {t('common.confirm')}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
