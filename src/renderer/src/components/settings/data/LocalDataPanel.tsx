import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Label } from '@renderer/components/ui/label'
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
  AlertDialogTrigger,
} from '@renderer/components/ui/alert-dialog'

/**
 * "Local Data Settings" panel — currently just hosts the destructive
 * "clear all data" control. Lives under the Data Settings page now (no
 * longer a top-level sidebar entry).
 */
export function LocalDataPanel(): React.JSX.Element {
  const { t } = useTranslation()
  const [clearError, setClearError] = useState<string | null>(null)

  const handleClearData = async (): Promise<void> => {
    try {
      setClearError(null)
      const result = await window.api.clearAppData()
      if (!result.success) {
        setClearError(
          result.error ? t(result.error.code, result.error.params ?? {}) : 'Failed to clear data',
        )
      }
    } catch (e) {
      setClearError((e as Error).message)
    }
  }

  return (
    <div className="space-y-5">
      <div className="bg-card/50 rounded-xl border p-5">
        <h2 className="text-base font-semibold">{t('settings.data.title')}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t('settings.data.description')}</p>
      </div>

      <div className="bg-card/50 rounded-xl border p-5">
        <h3 className="text-sm font-semibold">{t('settings.data.dataManagement')}</h3>

        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Trash2 className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <div>
              <Label className="text-sm font-medium">{t('settings.data.clearData')}</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {t('settings.data.clearDataDescription')}
              </p>
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                {t('settings.data.clearData')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('settings.data.clearDataConfirmTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('settings.data.clearDataConfirmDescription')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearData} variant="destructive">
                  {t('settings.data.clearDataConfirmButton')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        {clearError && <p className="text-destructive mt-2 text-xs">{clearError}</p>}
      </div>
    </div>
  )
}
