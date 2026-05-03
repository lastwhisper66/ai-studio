import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'

export interface BackupPasswordDialogProps {
  open: boolean
  /** 'export' requires confirm; 'import' / 'restore' only ask once. */
  mode: 'export' | 'import' | 'restore'
  /** Optional preview info shown above the input (e.g. peeked file metadata). */
  preview?: React.ReactNode
  onCancel: () => void
  onSubmit: (password: string) => Promise<void> | void
  /** External error to show under the input (e.g. wrong password). */
  errorText?: string | null
}

export function BackupPasswordDialog({
  open,
  mode,
  preview,
  onCancel,
  onSubmit,
  errorText,
}: BackupPasswordDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [localErr, setLocalErr] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setPw('')
      setPw2('')
      setLocalErr(null)
      setBusy(false)
    }
  }, [open])

  const titleKey =
    mode === 'export'
      ? 'settings.backup.password.exportTitle'
      : mode === 'import'
        ? 'settings.backup.password.importTitle'
        : 'settings.backup.password.restoreTitle'
  const descKey =
    mode === 'export'
      ? 'settings.backup.password.exportDesc'
      : 'settings.backup.password.importDesc'
  const submitKey = mode === 'export' ? 'common.confirm' : 'settings.backup.password.unlock'

  const submit = async (): Promise<void> => {
    if (!pw) {
      setLocalErr(t('settings.backup.password.required'))
      return
    }
    if (mode === 'export' && pw !== pw2) {
      setLocalErr(t('settings.backup.password.mismatch'))
      return
    }
    setBusy(true)
    setLocalErr(null)
    try {
      await onSubmit(pw)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(titleKey)}</DialogTitle>
          <DialogDescription>{t(descKey)}</DialogDescription>
        </DialogHeader>

        {preview && <div className="text-sm rounded-md bg-muted p-3">{preview}</div>}

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="bp-pw">{t('settings.backup.password.label')}</Label>
            <Input
              id="bp-pw"
              type="password"
              autoFocus
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>
          {mode === 'export' && (
            <div className="grid gap-1.5">
              <Label htmlFor="bp-pw2">{t('settings.backup.password.confirmLabel')}</Label>
              <Input
                id="bp-pw2"
                type="password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
              />
            </div>
          )}
          {(localErr || errorText) && (
            <p className="text-xs text-destructive">{localErr ?? errorText}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button disabled={busy} onClick={submit}>
            {busy ? t('common.saving') : t(submitKey)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
