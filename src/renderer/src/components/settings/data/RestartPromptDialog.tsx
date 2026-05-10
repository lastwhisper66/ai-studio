import { useTranslation } from 'react-i18next'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@renderer/components/ui/alert-dialog'

interface RestartPromptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Modal prompt shown after a successful backup import / remote restore. The
 * in-memory state of the renderer (Zustand stores) is now out of sync with the
 * database; restarting the app is the simplest way to reload everything. The
 * dialog has no Cancel button — the user must restart to see the new data.
 */
export function RestartPromptDialog({
  open,
  onOpenChange,
}: RestartPromptDialogProps): React.JSX.Element {
  const { t } = useTranslation()

  const handleRestart = async (): Promise<void> => {
    await window.api.relaunchApp()
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('settings.backup.restartPrompt.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('settings.backup.restartPrompt.description')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={handleRestart}>
            {t('settings.backup.restartPrompt.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
