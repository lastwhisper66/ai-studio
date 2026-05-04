import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { useBackupStore } from '@renderer/stores/backupStore'
import { useLocalizedError } from '@renderer/hooks/useLocalizedError'
import { ERROR_CODES, type LocalizedError } from '@shared/errors'
import type { BackupImportMode, RollbackBackupItem } from '@shared/types'
import { BackupPasswordDialog } from './BackupPasswordDialog'
import { cn } from '@renderer/lib/utils'

/**
 * Browse local pre-apply rollback snapshots and restore one.
 *
 * Rollback files are written by `BackupSyncService.writeRollback()` every
 * time it's about to apply a cloud snapshot. They live under
 * `<dataDir>/backups/auto-rollback/` and let the user undo a sync that
 * turned out to be wrong (e.g. accidental sync from a stale device).
 *
 * Restore reuses the existing `importFromFile` flow — the rollback file is
 * just an `.aibackup` on disk, so passing its absolute path through the
 * normal import handler does the right thing.
 *
 * The fetch + state-reset logic lives in an inner `<RollbackListing>`
 * component that re-mounts via `key` whenever the dialog re-opens. Same
 * pattern as `BackupHistoryDialog` — keeps initial state always at "loading"
 * without needing setState-in-effect (which would re-fire if hook deps
 * changed identity, the bug the user reported as "stuck loading").
 */
export function BackupRollbackDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('settings.backup.rollback.title')}</DialogTitle>
          <DialogDescription>{t('settings.backup.rollback.desc')}</DialogDescription>
        </DialogHeader>

        <RollbackListing key={open ? 'open' : 'closed'} active={open} />

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Inner component: fetches the local rollback list once on mount and renders
 * restore controls. The parent re-mounts this whenever the dialog open state
 * flips, so `items === null` is the canonical "still loading" state — there
 * is no setState-in-effect that could trigger render loops.
 */
function RollbackListing({ active }: { active: boolean }): React.JSX.Element {
  const { t } = useTranslation()
  const localizedError = useLocalizedError()
  const listRollbacks = useBackupStore((s) => s.listRollbacks)
  const importFromFile = useBackupStore((s) => s.importFromFile)

  const [items, setItems] = useState<RollbackBackupItem[] | null>(null)
  const [fetchError, setFetchError] = useState<LocalizedError | null>(null)
  const [pwOpen, setPwOpen] = useState(false)
  const [pendingPath, setPendingPath] = useState<string | null>(null)
  const [mode, setMode] = useState<BackupImportMode>('replace')
  const [pwError, setPwError] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    // The parent only mounts us when the dialog is opening. The `active`
    // gate is a defensive no-op if the parent ever decides to keep us
    // mounted — the listRollbacks IPC won't fire when the dialog is hidden.
    if (!active) return
    let cancelled = false
    listRollbacks().then((r) => {
      if (cancelled) return
      if (Array.isArray(r)) {
        setItems(r)
      } else {
        setItems([])
        setFetchError(r.error)
      }
    })
    return () => {
      cancelled = true
    }
  }, [active, listRollbacks])

  const onPickRestore = (filePath: string, m: BackupImportMode): void => {
    setPendingPath(filePath)
    setMode(m)
    setPwError(null)
    setPwOpen(true)
  }

  const onPwSubmit = async (password: string | null): Promise<void> => {
    if (!pendingPath) return
    const r = await importFromFile(pendingPath, password, mode)
    if ('error' in r) {
      // Wrong password keeps the password dialog open so the user can retry
      // without re-picking the file.
      if (r.error.code === ERROR_CODES.BACKUP_PASSWORD_WRONG) {
        setPwError(t('errors.backup.passwordWrong'))
        return
      }
      setStatusMsg({ kind: 'err', text: localizedError(r.error) })
    } else {
      setStatusMsg({
        kind: 'ok',
        text: t('settings.backup.rollback.restoreOk', {
          providers: r.providers,
          assistants: r.assistants,
          settings: r.settings,
        }),
      })
    }
    setPwOpen(false)
    setPendingPath(null)
  }

  const loading = items === null && !fetchError
  return (
    <>
      {loading ? (
        <p className="text-muted-foreground text-sm">{t('settings.backup.rollback.loading')}</p>
      ) : fetchError ? (
        <p className="text-destructive text-sm">{localizedError(fetchError)}</p>
      ) : items && items.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('settings.backup.rollback.empty')}</p>
      ) : (
        <div className="max-h-96 divide-y overflow-auto rounded-md border">
          {items?.map((item) => (
            <div key={item.filePath} className="flex items-center justify-between gap-4 p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{item.fileName}</div>
                <div className="text-muted-foreground flex flex-wrap gap-x-2 text-xs">
                  <span>
                    {item.createdAt
                      ? new Date(item.createdAt).toLocaleString()
                      : t('settings.backup.rollback.unknownTime')}
                  </span>
                  <span>· {(item.size / 1024).toFixed(1)} KB</span>
                  <span className="text-muted-foreground/80">
                    · {t(`settings.backup.rollback.triggeredBy.${item.triggeredBy}`)}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onPickRestore(item.filePath, 'replace')}>
                  {t('settings.backup.rollback.restoreReplace')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onPickRestore(item.filePath, 'merge')}>
                  {t('settings.backup.rollback.restoreMerge')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {statusMsg && (
        <p
          className={cn(
            'text-xs',
            statusMsg.kind === 'ok' ? 'text-emerald-600' : 'text-destructive',
          )}>
          {statusMsg.text}
        </p>
      )}

      <BackupPasswordDialog
        open={pwOpen}
        mode="restore"
        errorText={pwError}
        onCancel={() => {
          setPwOpen(false)
          setPendingPath(null)
        }}
        onSubmit={onPwSubmit}
      />
    </>
  )
}
