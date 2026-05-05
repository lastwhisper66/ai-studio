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
import { type LocalizedError } from '@shared/errors'
import type { BackupImportMode, RollbackBackupItem } from '@shared/types'
import { cn } from '@renderer/lib/utils'

/**
 * Browse local pre-apply rollback snapshots and restore one.
 *
 * Rollback files are written by `writePreApplyRollback()` in
 * `src/main/backup/index.ts` every time the app is about to overwrite local
 * data in "replace" mode — that covers cloud-sync downloads, cloud history
 * restores, and local `.aibackup` file imports. They live under
 * `<dataDir>/backups/auto-rollback/` along with a `.meta.json` sidecar that
 * records which event produced them (`triggeredBy`).
 *
 * Restore reuses the existing `importFromFile` flow — the rollback file is
 * just a plaintext `.aibackup` on disk, so passing its absolute path through
 * the normal import handler does the right thing.
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

function RollbackListing({ active }: { active: boolean }): React.JSX.Element {
  const { t } = useTranslation()
  const localizedError = useLocalizedError()
  const listRollbacks = useBackupStore((s) => s.listRollbacks)
  const importFromFile = useBackupStore((s) => s.importFromFile)

  const [items, setItems] = useState<RollbackBackupItem[] | null>(null)
  const [fetchError, setFetchError] = useState<LocalizedError | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
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

  const onPickRestore = async (filePath: string, m: BackupImportMode): Promise<void> => {
    if (restoring) return
    setRestoring(true)
    setStatusMsg(null)
    try {
      const r = await importFromFile(filePath, m)
      if ('error' in r) {
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
    } finally {
      setRestoring(false)
    }
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
                  disabled={restoring}
                  onClick={() => onPickRestore(item.filePath, 'replace')}>
                  {t('settings.backup.rollback.restoreReplace')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={restoring}
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
    </>
  )
}
