import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { useBackupStore } from '@renderer/stores/backupStore'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { useLocalizedError } from '@renderer/hooks/useLocalizedError'
import { cn } from '@renderer/lib/utils'
import { ERROR_CODES } from '@shared/errors'
import type { BackupFileMeta, BackupImportMode, RemoteConfig, SyncStatus } from '@shared/types'
import { BackupPasswordDialog } from './BackupPasswordDialog'
import { BackupRemoteDialog } from './BackupRemoteDialog'
import { BackupHistoryDialog } from './BackupHistoryDialog'

export function BackupSection(): React.JSX.Element {
  const { t } = useTranslation()
  const localizedError = useLocalizedError()
  const exportToFile = useBackupStore((s) => s.exportToFile)
  const importFromFile = useBackupStore((s) => s.importFromFile)
  const peekFile = useBackupStore((s) => s.peekFile)
  const remoteConfig = useBackupStore((s) => s.remoteConfig)
  const clearRemoteConfig = useBackupStore((s) => s.clearRemoteConfig)
  const status = useBackupStore((s) => s.status)
  const syncNow = useBackupStore((s) => s.syncNow)
  const loadStatus = useBackupStore((s) => s.loadStatus)
  const progress = useBackupStore((s) => s.progress)
  // Read raw setting strings for the cloud-card form fields. The values are
  // pushed in by the main process via `settings:changed`, so this stays in
  // sync without a manual refetch when another window mutates them.
  const maxRetainedSetting = useSettingsStore((s) => s.settings['backup.maxRetainedBackups'])

  const [importMode, setImportMode] = useState<BackupImportMode>('replace')
  const [exportOpen, setExportOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [pendingFilePath, setPendingFilePath] = useState<string | undefined>(undefined)
  const [peekMeta, setPeekMeta] = useState<BackupFileMeta | null>(null)
  const [pwError, setPwError] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [cloudMsg, setCloudMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [remoteDialogOpen, setRemoteDialogOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  const openExport = (): void => {
    setPwError(null)
    setStatusMsg(null)
    setExportOpen(true)
  }

  const handleExportSubmit = async (password: string): Promise<void> => {
    const r = await exportToFile(password)
    if ('error' in r) {
      // User-cancelled the OS save dialog → don't surface as error.
      if (r.error.code !== ERROR_CODES.BACKUP_CANCELLED) {
        setStatusMsg({ kind: 'err', text: localizedError(r.error) })
      }
      setExportOpen(false)
      return
    }
    setStatusMsg({ kind: 'ok', text: t('settings.backup.exportSuccess', { path: r.filePath }) })
    setExportOpen(false)
  }

  const openImport = async (): Promise<void> => {
    setStatusMsg(null)
    // 1. Pick the file (native dialog).
    const pickResult = await window.api.backup.pickFile()
    if (!pickResult.success) {
      setStatusMsg({ kind: 'err', text: localizedError(pickResult.error) })
      return
    }
    if (!pickResult.data) return // user cancelled
    const filePath = pickResult.data.filePath
    // 2. Peek the plaintext header so we can show meta in the password dialog.
    const meta = await peekFile(filePath)
    if ('error' in meta) {
      setStatusMsg({ kind: 'err', text: localizedError(meta.error) })
      return
    }
    setPeekMeta(meta)
    setPendingFilePath(filePath)
    setPwError(null)
    setImportOpen(true)
  }

  const closeImport = (): void => {
    setImportOpen(false)
    setPendingFilePath(undefined)
    setPeekMeta(null)
    setPwError(null)
  }

  const handleImportSubmit = async (password: string): Promise<void> => {
    if (!pendingFilePath) return
    const r = await importFromFile(pendingFilePath, password, importMode)
    if ('error' in r) {
      if (r.error.code === ERROR_CODES.BACKUP_PASSWORD_WRONG) {
        setPwError(t('errors.backup.passwordWrong'))
        return
      }
      setStatusMsg({ kind: 'err', text: localizedError(r.error) })
      closeImport()
      return
    }
    setStatusMsg({
      kind: 'ok',
      text: t('settings.backup.importSuccess', {
        providers: r.providers,
        assistants: r.assistants,
        settings: r.settings,
      }),
    })
    closeImport()
  }

  // ---------------- Cloud handlers ----------------

  const handleSyncNow = async (): Promise<void> => {
    setCloudMsg(null)
    const r = await syncNow()
    if ('error' in r) {
      setCloudMsg({ kind: 'err', text: localizedError(r.error) })
      return
    }
    setCloudMsg({
      kind: 'ok',
      text: t(`settings.backup.syncResult.${r.direction}`),
    })
  }

  const handleClearRemote = async (): Promise<void> => {
    setCloudMsg(null)
    await clearRemoteConfig()
  }

  const handleIntervalChange = async (minutes: number): Promise<void> => {
    setCloudMsg(null)
    const r = await window.api.setSetting('backup.autoSyncIntervalMinutes', String(minutes))
    if (!r.success) {
      setCloudMsg({ kind: 'err', text: localizedError(r.error) })
      return
    }
    // Refresh status so the <select> reflects the persisted value (the
    // setting also flows back via the settings:changed broadcast, but
    // the SyncStatus snapshot only refreshes on demand).
    await loadStatus()
  }

  const handleMaxRetainedChange = async (n: number): Promise<void> => {
    setCloudMsg(null)
    const clamped = Math.max(1, Math.min(50, n || 5))
    const r = await window.api.setSetting('backup.maxRetainedBackups', String(clamped))
    if (!r.success) {
      setCloudMsg({ kind: 'err', text: localizedError(r.error) })
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-xl border bg-card/50 p-5">
        <h2 className="text-base font-semibold">{t('settings.backup.title')}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t('settings.backup.description')}</p>
      </div>

      {/* In-flight progress indicator. Hidden during the `apply` phase since
          DB writes happen inside a single transaction and finish in <100ms —
          flashing a label is more distracting than informative. */}
      {progress && progress.phase !== 'apply' && (
        <div className="bg-card/50 text-muted-foreground rounded-md border px-3 py-2 text-xs">
          {t(`settings.backup.progress.${progress.phase}`)}
          {typeof progress.percent === 'number' ? ` (${progress.percent}%)` : ''}
        </div>
      )}

      {/* Local backup card */}
      <div className="rounded-xl border bg-card/50 p-5 space-y-4">
        <h3 className="text-sm font-semibold">{t('settings.backup.localTitle')}</h3>

        <div className="flex flex-wrap gap-2">
          <Button onClick={openExport}>{t('settings.backup.exportButton')}</Button>
          <Button variant="outline" onClick={openImport}>
            {t('settings.backup.importButton')}
          </Button>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">{t('settings.backup.importMode')}</Label>
          <div className="mt-2 flex gap-2">
            <ModeButton
              active={importMode === 'replace'}
              onClick={() => setImportMode('replace')}
              label={t('settings.backup.modeReplace')}
            />
            <ModeButton
              active={importMode === 'merge'}
              onClick={() => setImportMode('merge')}
              label={t('settings.backup.modeMerge')}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">{t('settings.backup.passwordHint')}</p>

        {statusMsg && (
          <p
            className={cn(
              'text-xs',
              statusMsg.kind === 'ok' ? 'text-emerald-600' : 'text-destructive',
            )}>
            {statusMsg.text}
          </p>
        )}
      </div>

      {/* Cloud sync card */}
      <CloudCard
        remoteConfig={remoteConfig}
        status={status}
        cloudMsg={cloudMsg}
        maxRetained={parseInt(maxRetainedSetting ?? '5', 10)}
        onConfigure={() => setRemoteDialogOpen(true)}
        onClear={handleClearRemote}
        onSyncNow={handleSyncNow}
        onOpenHistory={() => {
          setCloudMsg(null)
          setHistoryOpen(true)
        }}
        onIntervalChange={handleIntervalChange}
        onMaxRetainedChange={handleMaxRetainedChange}
      />

      <BackupRemoteDialog
        open={remoteDialogOpen}
        initial={remoteConfig}
        onCancel={() => setRemoteDialogOpen(false)}
        onSaved={() => setRemoteDialogOpen(false)}
      />

      <BackupHistoryDialog open={historyOpen} onClose={() => setHistoryOpen(false)} />

      <BackupPasswordDialog
        open={exportOpen}
        mode="export"
        onCancel={() => setExportOpen(false)}
        onSubmit={handleExportSubmit}
      />
      <BackupPasswordDialog
        open={importOpen}
        mode="import"
        onCancel={closeImport}
        onSubmit={handleImportSubmit}
        errorText={pwError}
        preview={
          peekMeta ? (
            <div className="grid gap-1">
              <div>
                <span className="text-muted-foreground">{t('settings.backup.peek.created')}: </span>
                {new Date(peekMeta.createdAt).toLocaleString()}
              </div>
              <div>
                <span className="text-muted-foreground">
                  {t('settings.backup.peek.appVersion')}:{' '}
                </span>
                {peekMeta.appVersion}
              </div>
            </div>
          ) : undefined
        }
      />
    </div>
  )
}

function ModeButton({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-md border px-3 py-1.5 text-sm transition-colors',
        active
          ? 'border-primary bg-primary/10 text-foreground'
          : 'border-border text-muted-foreground hover:bg-accent/50',
      )}>
      {label}
    </button>
  )
}

/**
 * Cloud-sync card. Splits into two states:
 *   - **unconfigured**: prompt to configure a remote.
 *   - **configured**: show last-synced/last-changed/last-error, sync-now /
 *     history / reconfigure / clear buttons, plus the auto-sync interval and
 *     retention selectors.
 *
 * Status messages are inline (no toast), passed in from the parent so the
 * "sync now" outcome can persist after the request completes.
 */
function CloudCard({
  remoteConfig,
  status,
  cloudMsg,
  maxRetained,
  onConfigure,
  onClear,
  onSyncNow,
  onOpenHistory,
  onIntervalChange,
  onMaxRetainedChange,
}: {
  remoteConfig: RemoteConfig | null
  status: SyncStatus | null
  cloudMsg: { kind: 'ok' | 'err'; text: string } | null
  maxRetained: number
  onConfigure: () => void
  onClear: () => Promise<void>
  onSyncNow: () => Promise<void>
  onOpenHistory: () => void
  onIntervalChange: (minutes: number) => Promise<void>
  onMaxRetainedChange: (n: number) => Promise<void>
}): React.JSX.Element {
  const { t } = useTranslation()
  const localizedError = useLocalizedError()

  if (!remoteConfig) {
    return (
      <div className="rounded-xl border bg-card/50 space-y-3 p-5">
        <h3 className="text-sm font-semibold">{t('settings.backup.cloudTitle')}</h3>
        <p className="text-muted-foreground text-xs">{t('settings.backup.cloudNotConfigured')}</p>
        <Button onClick={onConfigure}>{t('settings.backup.configureButton')}</Button>
      </div>
    )
  }

  const interval = status?.autoSyncIntervalMinutes ?? 0

  return (
    <div className="rounded-xl border bg-card/50 space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{t('settings.backup.cloudTitle')}</h3>
          <p className="text-muted-foreground mt-1 text-xs">
            {t('settings.backup.cloudConfigured', {
              type: remoteConfig.type === 'webdav' ? 'WebDAV' : 'S3',
            })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs">
          {status?.lastSyncedAt && (
            <span className="text-muted-foreground">
              {t('settings.backup.lastSynced', {
                at: new Date(status.lastSyncedAt).toLocaleString(),
              })}
            </span>
          )}
          {status?.lastLocalChangeAt && (
            <span className="text-muted-foreground">
              {t('settings.backup.lastChanged', {
                at: new Date(status.lastLocalChangeAt).toLocaleString(),
              })}
            </span>
          )}
          {status?.lastError && (
            <span className="text-destructive">{localizedError(status.lastError)}</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={onSyncNow} disabled={status?.isSyncing}>
          {status?.isSyncing ? t('settings.backup.syncing') : t('settings.backup.syncNowButton')}
        </Button>
        <Button variant="outline" onClick={onOpenHistory}>
          {t('settings.backup.historyButton')}
        </Button>
        <Button variant="ghost" onClick={onConfigure}>
          {t('settings.backup.reconfigureButton')}
        </Button>
        <Button variant="ghost" onClick={() => onClear()}>
          {t('settings.backup.clearConfigButton')}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">{t('settings.backup.intervalLabel')}</Label>
          <select
            className="bg-background mt-1 h-9 w-full rounded-md border px-2 text-sm"
            value={interval}
            onChange={(e) => onIntervalChange(parseInt(e.target.value, 10))}>
            <option value={0}>{t('settings.backup.intervalOff')}</option>
            <option value={15}>{t('settings.backup.interval15')}</option>
            <option value={30}>{t('settings.backup.interval30')}</option>
            <option value={60}>{t('settings.backup.interval60')}</option>
            <option value={180}>{t('settings.backup.interval180')}</option>
            <option value={720}>{t('settings.backup.interval720')}</option>
          </select>
        </div>
        <div>
          <Label className="text-xs">{t('settings.backup.maxRetainedLabel')}</Label>
          <Input
            type="number"
            min={1}
            max={50}
            className="mt-1"
            value={maxRetained}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10)
              if (Number.isFinite(n)) onMaxRetainedChange(n)
            }}
          />
        </div>
      </div>

      {cloudMsg && (
        <p
          className={cn(
            'text-xs',
            cloudMsg.kind === 'ok' ? 'text-emerald-600' : 'text-destructive',
          )}>
          {cloudMsg.text}
        </p>
      )}
    </div>
  )
}
