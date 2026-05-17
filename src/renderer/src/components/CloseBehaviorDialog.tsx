import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => handleChoice(false)}>
            {t('closeBehavior.quitTitle')}
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => handleChoice(true)}>
            {t('closeBehavior.minimizeTitle')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
