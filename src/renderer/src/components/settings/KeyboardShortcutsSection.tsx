import { useCallback, useState } from 'react'
import { RotateCcw, Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_KEYBINDINGS, type KeybindingActionId } from '@shared/keybindings'
import { useKeybindingStore } from '@renderer/stores/keybindingStore'
import { ShortcutRecorder, ShortcutDisplay } from './ShortcutRecorder'
import { Button } from '@renderer/components/ui/button'
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
  const { overrides, getAccelerator, getAllEffective, setOverride, resetAction, resetAll } =
    useKeybindingStore()
  const [conflict, setConflict] = useState<ConflictInfo | null>(null)

  const handleChange = useCallback(
    (actionId: KeybindingActionId, accelerator: string) => {
      // Check for conflicts among configurable shortcuts
      const effective = getAllEffective()
      for (const [id, accel] of Object.entries(effective)) {
        const otherId = id as KeybindingActionId
        if (otherId === actionId) continue
        if (accel.toLowerCase() === accelerator.toLowerCase()) {
          setConflict({ targetActionId: actionId, conflictActionId: otherId, accelerator })
          return
        }
      }
      setOverride(actionId, accelerator)
    },
    [getAllEffective, setOverride],
  )

  const handleConflictConfirm = useCallback(async () => {
    if (!conflict) return
    // If conflicting with a readOnly shortcut, we can't reassign — just reject
    if (DEFAULT_KEYBINDINGS[conflict.conflictActionId].readOnly) {
      setConflict(null)
      return
    }
    // Remove the conflicting binding first, then set the new one
    await resetAction(conflict.conflictActionId)
    await setOverride(conflict.targetActionId, conflict.accelerator)
    setConflict(null)
  }, [conflict, resetAction, setOverride])

  const isOverridden = (actionId: KeybindingActionId): boolean => {
    return actionId in overrides
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
              {items.map(([actionId, def]) => (
                <div key={actionId} className="flex items-center justify-between gap-4">
                  <span className="text-sm">{t(def.labelKey)}</span>
                  <div className="flex items-center gap-2">
                    {def.readOnly ? (
                      <div className="flex items-center gap-2">
                        <ShortcutDisplay accelerator={getAccelerator(actionId)} />
                        <Lock className="text-muted-foreground size-3.5" />
                      </div>
                    ) : (
                      <>
                        <ShortcutRecorder
                          value={getAccelerator(actionId)}
                          onChange={(accel) => handleChange(actionId, accel)}
                        />
                        {isOverridden(actionId) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => resetAction(actionId)}
                            title={t('common.reset')}>
                            <RotateCcw className="size-3.5" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Conflict confirmation dialog */}
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
