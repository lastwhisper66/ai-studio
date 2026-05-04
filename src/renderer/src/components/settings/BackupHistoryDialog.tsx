import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { Button } from '@renderer/components/ui/button'
import { useBackupStore } from '@renderer/stores/backupStore'
import { useLocalizedError } from '@renderer/hooks/useLocalizedError'
import { ERROR_CODES, type LocalizedError } from '@shared/errors'
import type { BackupImportMode, RemoteBackupItem, RemoteType } from '@shared/types'
import { BackupPasswordDialog } from './BackupPasswordDialog'
import { cn } from '@renderer/lib/utils'

/**
 * Cloud-backup history browser. Lists every `.aibackup` snapshot found under
 * the selected remote's `backups/` prefix, with metadata peeked from each
 * header.
 *
 * When BOTH WebDAV and S3 are configured, a tabs row at the top lets the
 * user switch between them. The default tab is the first remote that's
 * configured (WebDAV-then-S3 in canonical order).
 *
 * Restore flow: pick replace/merge → password dialog → applySnapshot via
 * the sync-service. Errors stay inline (no toast) per project convention.
 */
export function BackupHistoryDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const remoteConfigs = useBackupStore((s) => s.remoteConfigs)

  const availableTypes = useMemo<RemoteType[]>(() => {
    const types: RemoteType[] = []
    if (remoteConfigs.webdav) types.push('webdav')
    if (remoteConfigs.s3) types.push('s3')
    return types
  }, [remoteConfigs.webdav, remoteConfigs.s3])

  // The user can override the active tab; if their pick stops being valid
  // (e.g. they cleared that remote), fall back to the first available one.
  const [userPick, setUserPick] = useState<RemoteType | null>(null)
  const activeType: RemoteType | null =
    userPick && availableTypes.includes(userPick) ? userPick : (availableTypes[0] ?? null)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('settings.backup.history.title')}</DialogTitle>
          <DialogDescription>{t('settings.backup.history.desc')}</DialogDescription>
        </DialogHeader>

        {availableTypes.length > 1 && activeType && (
          <Tabs value={activeType} onValueChange={(v) => setUserPick(v as RemoteType)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="webdav" disabled={!remoteConfigs.webdav}>
                WebDAV
              </TabsTrigger>
              <TabsTrigger value="s3" disabled={!remoteConfigs.s3}>
                S3
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {!activeType ? (
          <p className="text-muted-foreground text-sm">{t('settings.backup.cloudNotConfigured')}</p>
        ) : (
          // Keyed inner component re-mounts whenever (open, activeType)
          // changes — that's how each remote's listing fetches fresh from
          // a clean state instead of relying on setState-in-effect.
          <HistoryListing key={`${open ? 'open' : 'closed'}-${activeType}`} type={activeType} />
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

/**
 * Inner component: fetches a single remote's listing and renders restore
 * controls. Re-mounted by the parent's `key` whenever the active remote (or
 * dialog open state) changes — so initial state is always "loading", which
 * sidesteps the setState-in-effect lint rule.
 */
function HistoryListing({ type }: { type: RemoteType }): React.JSX.Element {
  const { t } = useTranslation()
  const localizedError = useLocalizedError()
  const listRemote = useBackupStore((s) => s.listRemote)
  const restoreFromRemote = useBackupStore((s) => s.restoreFromRemote)

  const [items, setItems] = useState<RemoteBackupItem[] | null>(null)
  const [fetchError, setFetchError] = useState<LocalizedError | null>(null)
  const [pwOpen, setPwOpen] = useState(false)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [mode, setMode] = useState<BackupImportMode>('replace')
  const [pwError, setPwError] = useState<string | null>(null)
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

  const onPickRestore = (key: string, m: BackupImportMode): void => {
    setPendingKey(key)
    setMode(m)
    setPwError(null)
    setPwOpen(true)
  }

  const onPwSubmit = async (password: string): Promise<void> => {
    if (!pendingKey) return
    const r = await restoreFromRemote(type, pendingKey, password, mode)
    if (r && 'error' in r) {
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
                  onClick={() => onPickRestore(item.key, 'replace')}>
                  {t('settings.backup.history.restoreReplace')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onPickRestore(item.key, 'merge')}>
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
