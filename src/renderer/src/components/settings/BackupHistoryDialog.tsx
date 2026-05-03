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
import { ERROR_CODES } from '@shared/errors'
import type { BackupImportMode, RemoteBackupItem } from '@shared/types'
import { BackupPasswordDialog } from './BackupPasswordDialog'
import { cn } from '@renderer/lib/utils'

/**
 * Cloud-backup history browser. Lists every `.aibackup` snapshot found under
 * the remote's `backups/` prefix, with metadata peeked from each header.
 *
 * Restore flow: pick replace/merge → password dialog → applySnapshot via the
 * sync-service. Errors stay inline (no toast) per project convention.
 */
export function BackupHistoryDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const localizedError = useLocalizedError()
  const listRemote = useBackupStore((s) => s.listRemote)
  const restoreFromRemote = useBackupStore((s) => s.restoreFromRemote)

  const [items, setItems] = useState<RemoteBackupItem[]>([])
  const [loading, setLoading] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [mode, setMode] = useState<BackupImportMode>('replace')
  const [pwError, setPwError] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    if (!open) return
    setStatusMsg(null)
    setLoading(true)
    listRemote().then((r) => {
      setLoading(false)
      if (Array.isArray(r)) {
        setItems(r)
      } else {
        setItems([])
        setStatusMsg({ kind: 'err', text: localizedError(r.error) })
      }
    })
  }, [open, listRemote, localizedError])

  const onPickRestore = (key: string, m: BackupImportMode): void => {
    setPendingKey(key)
    setMode(m)
    setPwError(null)
    setPwOpen(true)
  }

  const onPwSubmit = async (password: string): Promise<void> => {
    if (!pendingKey) return
    const r = await restoreFromRemote(pendingKey, password, mode)
    if (r && 'error' in r) {
      // Wrong-password is the one error worth keeping the dialog open for —
      // every other failure surfaces in the parent and aborts.
      if (r.error.code === ERROR_CODES.BACKUP_PASSWORD_WRONG) {
        setPwError(t('errors.backup.passwordWrong'))
        return
      }
      setStatusMsg({ kind: 'err', text: localizedError(r.error) })
    } else {
      setStatusMsg({ kind: 'ok', text: t('settings.backup.history.restoreOk') })
    }
    setPwOpen(false)
    setPendingKey(null)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('settings.backup.history.title')}</DialogTitle>
            <DialogDescription>{t('settings.backup.history.desc')}</DialogDescription>
          </DialogHeader>

          {loading ? (
            <p className="text-muted-foreground text-sm">{t('settings.backup.history.loading')}</p>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('settings.backup.history.empty')}</p>
          ) : (
            <div className="max-h-96 divide-y overflow-auto rounded-md border">
              {items.map((item) => (
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
                      onClick={() => onPickRestore(item.key, 'replace')}>
                      {t('settings.backup.history.restoreReplace')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
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

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BackupPasswordDialog
        open={pwOpen}
        mode="restore"
        errorText={pwError}
        onCancel={() => {
          setPwOpen(false)
          setPendingKey(null)
        }}
        onSubmit={onPwSubmit}
      />
    </>
  )
}
