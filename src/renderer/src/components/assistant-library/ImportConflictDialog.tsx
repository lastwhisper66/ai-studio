import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { Assistant, ConflictItem, ImportResolution } from '@shared/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { cn } from '@renderer/lib/utils'

interface ImportConflictDialogProps {
  open: boolean
  conflicts: ConflictItem[]
  onCancel: () => void
  onApply: (resolutions: Array<ImportResolution & { template: Assistant }>) => void
}

type ActionId = 'skip' | 'overwrite' | 'asCopy'

export function ImportConflictDialog({
  open,
  conflicts,
  onCancel,
  onApply,
}: ImportConflictDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const [perRow, setPerRow] = useState<Record<string, ActionId>>({})

  const resolutions = useMemo(
    (): Array<ImportResolution & { template: Assistant }> =>
      conflicts.map((c) => ({
        templateId: c.existingId,
        action: perRow[c.template.id] ?? 'skip',
        template: c.template,
      })),
    [conflicts, perRow],
  )

  const setAction = (templateId: string, action: ActionId): void => {
    setPerRow((prev) => ({ ...prev, [templateId]: action }))
  }

  const setAll = (action: ActionId): void => {
    const next: Record<string, ActionId> = {}
    for (const c of conflicts) next[c.template.id] = action
    setPerRow(next)
  }

  const actionBtn = (rowId: string, action: ActionId, label: string): React.JSX.Element => {
    const active = (perRow[rowId] ?? 'skip') === action
    return (
      <button
        type="button"
        onClick={() => setAction(rowId, action)}
        className={cn(
          'rounded-md border px-2 py-0.5 text-[11px] transition-colors',
          active
            ? 'border-primary bg-primary/10 text-foreground'
            : 'border-border text-muted-foreground hover:bg-accent/50',
        )}>
        {label}
      </button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('library.import.dialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('library.import.applyAll')}{' '}
            <button className="underline hover:text-foreground" onClick={() => setAll('skip')}>
              {t('library.import.actions.skip')}
            </button>{' '}
            ·{' '}
            <button className="underline hover:text-foreground" onClick={() => setAll('overwrite')}>
              {t('library.import.actions.overwrite')}
            </button>{' '}
            ·{' '}
            <button className="underline hover:text-foreground" onClick={() => setAll('asCopy')}>
              {t('library.import.actions.asCopy')}
            </button>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] pr-2">
          <div className="space-y-2">
            {conflicts.map((c) => (
              <div
                key={c.template.id}
                className="flex items-center justify-between gap-3 rounded-md border p-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {c.template.icon} {c.template.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {c.reason === 'id'
                      ? t('library.import.conflicts.idExists')
                      : t('library.import.conflicts.nameExists')}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {actionBtn(c.template.id, 'skip', t('library.import.actions.skip'))}
                  {actionBtn(c.template.id, 'overwrite', t('library.import.actions.overwrite'))}
                  {actionBtn(c.template.id, 'asCopy', t('library.import.actions.asCopy'))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => onApply(resolutions)}>{t('common.confirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
