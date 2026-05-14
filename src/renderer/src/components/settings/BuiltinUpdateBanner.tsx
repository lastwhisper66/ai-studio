import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
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
import { useBuiltinUpdateStore } from '@renderer/stores/builtinUpdateStore'
import type { BuiltinCategory } from '@shared/types'

interface BuiltinUpdateBannerProps {
  category: BuiltinCategory
}

export function BuiltinUpdateBanner({
  category,
}: BuiltinUpdateBannerProps): React.JSX.Element | null {
  const { t } = useTranslation()
  const status = useBuiltinUpdateStore((s) => s.status?.[category])
  const applyUpdate = useBuiltinUpdateStore((s) => s.applyUpdate)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  if (!status?.hasUpdate) return null

  const handleConfirm = async (): Promise<void> => {
    setBusy(true)
    try {
      await applyUpdate(category)
    } finally {
      setBusy(false)
      setOpen(false)
    }
  }

  return (
    <>
      <div className="bg-primary/5 border-primary/20 mb-4 flex items-center justify-between gap-4 rounded-lg border p-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">{t('settings.builtinUpdates.title')}</p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {t('settings.builtinUpdates.description', {
                applied: status.appliedVersion,
                current: status.currentVersion,
              })}
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          {t('settings.builtinUpdates.applyButton')}
        </Button>
      </div>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.builtinUpdates.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.builtinUpdates.confirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={busy} variant="destructive">
              {t('settings.builtinUpdates.confirmAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
