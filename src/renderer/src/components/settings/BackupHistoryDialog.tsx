import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RestartPromptDialog } from './data/RestartPromptDialog'
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
import type { BackupImportMode, RemoteBackupItem, RemoteType } from '@shared/types'
import { cn } from '@renderer/lib/utils'

/**
 * Cloud-backup history browser scoped to a single remote. Each per-remote
 * detail page (WebDavPanel / S3Panel) opens its own instance with the
 * matching `remoteType`.
 *
 * Restore: pick replace/merge → applySnapshot via the sync-service. Backups
 * are plaintext, so no password prompt is needed.
 */
export function BackupHistoryDialog({
  open,
  onClose,
  remoteType,
}: {
  open: boolean
  onClose: () => void
  remoteType: RemoteType
}): React.JSX.Element {
  const { t } = useTranslation()
  const remoteConfigs = useBackupStore((s) => s.remoteConfigs)
  const configured = remoteType === 'webdav' ? !!remoteConfigs.webdav : !!remoteConfigs.s3

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('settings.backup.history.title')}</DialogTitle>
          <DialogDescription>{t('settings.backup.history.desc')}</DialogDescription>
        </DialogHeader>

        {!configured ? (
          <p className="text-muted-foreground text-sm">{t('settings.backup.cloudNotConfigured')}</p>
        ) : (
          <HistoryListing key={`${open ? 'open' : 'closed'}-${remoteType}`} type={remoteType} />
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function HistoryListing({ type }: { type: RemoteType }): React.JSX.Element {
  const { t } = useTranslation()
  const localizedError = useLocalizedError()
  const listRemote = useBackupStore((s) => s.listRemote)
  const restoreFromRemote = useBackupStore((s) => s.restoreFromRemote)
  const [restartPromptOpen, setRestartPromptOpen] = useState(false)

  const [items, setItems] = useState<RemoteBackupItem[] | null>(null)
  const [fetchError, setFetchError] = useState<LocalizedError | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    listRemote(type).then((r) => {
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
  }, [type, listRemote])

  const onPickRestore = async (key: string, m: BackupImportMode): Promise<void> => {
    if (restoring) return
    setRestoring(true)
    setStatusMsg(null)
    try {
      const r = await restoreFromRemote(type, key, m)
      if (r && 'error' in r) {
        setStatusMsg({ kind: 'err', text: localizedError(r.error) })
      } else {
        setStatusMsg({ kind: 'ok', text: t('settings.backup.history.restoreOk') })
        setRestartPromptOpen(true)
      }
    } finally {
      setRestoring(false)
    }
  }

  const loading = items === null && !fetchError
  return (
    <>
      {loading ? (
        <p className="text-muted-foreground text-sm">{t('settings.backup.history.loading')}</p>
      ) : fetchError ? (
        <p className="text-destructive text-sm">{localizedError(fetchError)}</p>
      ) : items && items.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('settings.backup.history.empty')}</p>
      ) : (
        <div className="max-h-96 divide-y overflow-auto rounded-md border">
          {items?.map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-4 p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{item.key}</div>
                <div className="text-muted-foreground text-xs">
                  {new Date(item.createdAt).toLocaleString()}
                  {item.appVersion ? ` · v${item.appVersion}` : ''}
                  {' · '}
                  {(item.size / 1024).toFixed(1)} KB
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={restoring}
                  onClick={() => onPickRestore(item.key, 'replace')}>
                  {t('settings.backup.history.restoreReplace')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={restoring}
                  onClick={() => onPickRestore(item.key, 'merge')}>
                  {t('settings.backup.history.restoreMerge')}
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
      <RestartPromptDialog open={restartPromptOpen} onOpenChange={setRestartPromptOpen} />
    </>
  )
}
