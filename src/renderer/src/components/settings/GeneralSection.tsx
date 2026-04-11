import { useEffect, useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Switch } from '@renderer/components/ui/switch'
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
import { useSettingsStore } from '@renderer/stores/settingsStore'

export function GeneralSection(): React.JSX.Element {
  const { t } = useTranslation()
  const { settings, saveSettings } = useSettingsStore()
  const [closeToTray, setCloseToTray] = useState(true)

  useEffect(() => {
    setCloseToTray(settings['app.closeToTray'] !== 'false')
  }, [settings])

  const handleCloseToTrayToggle = (checked: boolean): void => {
    setCloseToTray(checked)
    saveSettings({ 'app.closeToTray': String(checked) })
  }

  const [clearError, setClearError] = useState<string | null>(null)

  const handleClearData = async (): Promise<void> => {
    try {
      setClearError(null)
      const result = await window.api.clearAppData()
      // On success the app restarts, so this line only runs on failure
      if (!result.success) {
        setClearError(result.error || 'Failed to clear data')
      }
    } catch (e) {
      setClearError((e as Error).message)
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-card/50 p-5">
        <h2 className="text-base font-semibold">{t('settings.general.title')}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t('settings.general.description')}</p>
      </div>

      <div className="rounded-xl border bg-card/50 p-5">
        <h3 className="text-sm font-semibold">{t('settings.general.window')}</h3>

        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <X className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <div>
              <Label className="text-sm font-medium">{t('settings.general.closeToTray')}</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {t('settings.general.closeToTrayDescription')}
              </p>
            </div>
          </div>
          <Switch checked={closeToTray} onCheckedChange={handleCloseToTrayToggle} />
        </div>
      </div>

      <div className="rounded-xl border bg-card/50 p-5">
        <h3 className="text-sm font-semibold">{t('settings.general.dataManagement')}</h3>

        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Trash2 className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <div>
              <Label className="text-sm font-medium">{t('settings.general.clearData')}</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {t('settings.general.clearDataDescription')}
              </p>
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                {t('settings.general.clearData')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('settings.general.clearDataConfirmTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('settings.general.clearDataConfirmDescription')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClearData}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {t('settings.general.clearDataConfirmButton')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        {clearError && <p className="mt-2 text-xs text-destructive">{clearError}</p>}
      </div>
    </div>
  )
}
