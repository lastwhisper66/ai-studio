import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import { Checkbox } from '@renderer/components/ui/checkbox'
import { PasswordInput } from '@renderer/components/ui/password-input'
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
  /** Receives the password the user typed; `null` means "no encryption" was checked. */
  onSubmit: (password: string | null) => Promise<void> | void
  /** External error to show under the input (e.g. wrong password). */
  errorText?: string | null
}

/**
 * Shared password dialog for export / import / restore flows.
 *
 * The form's local state (password fields, busy flag) lives inside an inner
 * `<PasswordForm>` that re-mounts via `key` each time `open` flips. That way
 * we reset the form by remounting rather than calling setState inside an
 * effect — same pattern as `BackupHistoryDialog` / `BackupRollbackDialog`,
 * which keeps us clear of the `react-hooks/set-state-in-effect` rule and any
 * cascading-render footguns it warns about.
 *
 * `busyRef` is mirrored from the inner form's `busy` state so the outer
 * Dialog's `onOpenChange` can keep the original behavior — refuse to close
 * the dialog while a submission is in flight (preserves the user's password
 * input on transient network errors during restore).
 *
 * In `export` mode the form additionally exposes a "do not encrypt" checkbox
 * which submits `null` to `onSubmit` so the codec emits `encryption.algo:
 * 'none'`. Hidden in import/restore — the file format itself dictates whether
 * decryption is needed, and the parent should skip this dialog entirely when
 * `peekFile` reports `encrypted: false`.
 */
export function BackupPasswordDialog({
  open,
  mode,
  preview,
  onCancel,
  onSubmit,
  errorText,
}: BackupPasswordDialogProps): React.JSX.Element {
  const busyRef = useRef(false)
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busyRef.current && onCancel()}>
      <DialogContent>
        <PasswordForm
          key={open ? 'open' : 'closed'}
          mode={mode}
          preview={preview}
          onCancel={onCancel}
          onSubmit={onSubmit}
          errorText={errorText}
          busyRef={busyRef}
        />
      </DialogContent>
    </Dialog>
  )
}

function PasswordForm({
  mode,
  preview,
  onCancel,
  onSubmit,
  errorText,
  busyRef,
}: Omit<BackupPasswordDialogProps, 'open'> & {
  busyRef: React.MutableRefObject<boolean>
}): React.JSX.Element {
  const { t } = useTranslation()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [noEncryption, setNoEncryption] = useState(false)
  const [busy, setBusy] = useState(false)
  const [localErr, setLocalErr] = useState<string | null>(null)

  // Mirror busy → ref so the outer Dialog's onOpenChange can read it
  // synchronously without state-lift gymnastics. Effect-based sync (rather
  // than assigning during render) keeps `react-hooks/refs` happy.
  useEffect(() => {
    busyRef.current = busy
  }, [busy, busyRef])

  const titleKey =
    mode === 'export'
      ? 'settings.backup.password.exportTitle'
      : mode === 'import'
        ? 'settings.backup.password.importTitle'
        : 'settings.backup.password.restoreTitle'
  const descKey =
    mode === 'export'
      ? 'settings.backup.password.exportDesc'
      : mode === 'import'
        ? 'settings.backup.password.importDesc'
        : 'settings.backup.password.restoreDesc'
  const submitKey = mode === 'export' ? 'common.confirm' : 'settings.backup.password.unlock'

  const submit = async (): Promise<void> => {
    if (noEncryption && mode === 'export') {
      setBusy(true)
      setLocalErr(null)
      try {
        await onSubmit(null)
      } finally {
        setBusy(false)
      }
      return
    }
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
    <>
      <DialogHeader>
        <DialogTitle>{t(titleKey)}</DialogTitle>
        <DialogDescription>{t(descKey)}</DialogDescription>
      </DialogHeader>

      {preview && <div className="bg-muted rounded-md p-3 text-sm">{preview}</div>}

      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="bp-pw">{t('settings.backup.password.label')}</Label>
          <PasswordInput
            id="bp-pw"
            autoFocus
            value={pw}
            disabled={noEncryption}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </div>
        {mode === 'export' && (
          <div className="grid gap-1.5">
            <Label htmlFor="bp-pw2">{t('settings.backup.password.confirmLabel')}</Label>
            <PasswordInput
              id="bp-pw2"
              value={pw2}
              disabled={noEncryption}
              onChange={(e) => setPw2(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>
        )}
        {mode === 'export' && (
          <div className="grid gap-1.5">
            <div className="flex items-center gap-2">
              <Checkbox
                id="bp-no-encrypt"
                checked={noEncryption}
                onCheckedChange={(v) => {
                  const next = v === true
                  setNoEncryption(next)
                  if (next) {
                    setPw('')
                    setPw2('')
                    setLocalErr(null)
                  }
                }}
              />
              <Label htmlFor="bp-no-encrypt" className="text-xs font-normal">
                {t('settings.backup.passphrase.noEncrypt')}
              </Label>
            </div>
            {noEncryption && (
              <p className="text-xs text-amber-600">
                {t('settings.backup.passphrase.noEncryptWarning')}
              </p>
            )}
          </div>
        )}
        {(localErr || errorText) && (
          <p className="text-destructive text-xs">{localErr ?? errorText}</p>
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
    </>
  )
}
