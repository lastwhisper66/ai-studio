import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Minimize2, LogOut } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@renderer/components/ui/alert-dialog'
import { Button } from '@renderer/components/ui/button'
import { useSettingsStore } from '@renderer/stores/settingsStore'

export function CloseBehaviorDialog(): React.JSX.Element {
  const { t } = useTranslation()
  const saveSettings = useSettingsStore((s) => s.saveSettings)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const unsub = window.api.onWindowClosePrompt(() => {
      setOpen(true)
    })
    return unsub
  }, [])

  const handleChoice = async (closeToTray: boolean): Promise<void> => {
    setOpen(false)
    await saveSettings({
      'app.closeToTray': String(closeToTray),
      'app.closeBehaviorPrompted': 'true',
    })
    window.api.windowClose()
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('closeBehavior.title')}</AlertDialogTitle>
          <AlertDialogDescription>{t('closeBehavior.description')}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <Button
            variant="outline"
            className="h-auto flex-col items-start gap-2 p-4 text-left"
            onClick={() => handleChoice(true)}>
            <div className="flex items-center gap-2">
              <Minimize2 className="size-4" />
              <span className="text-sm font-medium">{t('closeBehavior.minimizeTitle')}</span>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              {t('closeBehavior.minimizeDescription')}
            </p>
          </Button>
          <Button
            variant="outline"
            className="h-auto flex-col items-start gap-2 p-4 text-left"
            onClick={() => handleChoice(false)}>
            <div className="flex items-center gap-2">
              <LogOut className="size-4" />
              <span className="text-sm font-medium">{t('closeBehavior.quitTitle')}</span>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              {t('closeBehavior.quitDescription')}
            </p>
          </Button>
        </div>
        <p className="text-muted-foreground mt-1 text-xs">{t('closeBehavior.hint')}</p>
      </AlertDialogContent>
    </AlertDialog>
  )
}
