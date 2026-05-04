import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { useBackupStore } from '@renderer/stores/backupStore'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { useLocalizedError } from '@renderer/hooks/useLocalizedError'
import { cn } from '@renderer/lib/utils'
import { BackupHistoryDialog } from '../BackupHistoryDialog'

/**
 * Cloud-sync overview header — rendered above whichever cloud panel
 * (WebDAV / S3) is currently selected. Holds the GLOBAL controls that
 * apply across all configured remotes:
 *   - last-synced / last-changed / last-error badges
 *   - sync-now + history buttons
 *   - auto-sync interval (drives the timer in the main process)
 *   - max retained backups
 *
 * The same instance shows on both cloud panels so users don't have to
 * hunt for these controls when configuring two remotes.
 */
export function CloudOverview(): React.JSX.Element {
  const { t } = useTranslation()
  const localizedError = useLocalizedError()
  const status = useBackupStore((s) => s.status)
  const remoteConfigs = useBackupStore((s) => s.remoteConfigs)
  const syncNow = useBackupStore((s) => s.syncNow)
  const loadStatus = useBackupStore((s) => s.loadStatus)
  const progress = useBackupStore((s) => s.progress)
  const maxRetainedSetting = useSettingsStore((s) => s.settings['backup.maxRetainedBackups'])

  const [cloudMsg, setCloudMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)

  const anyConfigured = !!(remoteConfigs.webdav || remoteConfigs.s3)
  const interval = status?.autoSyncIntervalMinutes ?? 0
  const maxRetained = parseInt(maxRetainedSetting ?? '5', 10)

  const handleSyncNow = async (): Promise<void> => {
    setCloudMsg(null)
    const r = await syncNow()
    if ('error' in r) {
      setCloudMsg({ kind: 'err', text: localizedError(r.error) })
      return
    }
    setCloudMsg({ kind: 'ok', text: t(`settings.backup.syncResult.${r.direction}`) })
  }

  const handleIntervalChange = async (minutes: number): Promise<void> => {
    setCloudMsg(null)
    const r = await window.api.setSetting('backup.autoSyncIntervalMinutes', String(minutes))
    if (!r.success) {
      setCloudMsg({ kind: 'err', text: localizedError(r.error) })
      return
    }
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
    <>
      <div className="bg-card/50 rounded-xl border p-5">
        <h2 className="text-base font-semibold">{t('settings.backup.cloudTitle')}</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {t('settings.data.cloud.overviewHint')}
        </p>

        {progress && progress.phase !== 'apply' && (
          <div className="bg-card text-muted-foreground mt-3 rounded-md border px-3 py-2 text-xs">
            {t(`settings.backup.progress.${progress.phase}`)}
            {typeof progress.percent === 'number' ? ` (${progress.percent}%)` : ''}
          </div>
        )}

        <div className="mt-4 flex flex-col gap-1 text-xs">
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
          {status?.lastWarning && !status.lastError && (
            <span className="text-amber-600">{status.lastWarning}</span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={handleSyncNow} disabled={!anyConfigured || status?.isSyncing}>
            {status?.isSyncing ? t('settings.backup.syncing') : t('settings.backup.syncNowButton')}
          </Button>
          <Button
            variant="outline"
            disabled={!anyConfigured}
            onClick={() => {
              setCloudMsg(null)
              setHistoryOpen(true)
            }}>
            {t('settings.backup.historyButton')}
          </Button>
        </div>

        {!anyConfigured && (
          <p className="text-muted-foreground mt-3 text-xs">
            {t('settings.backup.cloudNotConfigured')}
          </p>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">{t('settings.backup.intervalLabel')}</Label>
            <select
              className="bg-background mt-1 h-9 w-full rounded-md border px-2 text-sm"
              value={interval}
              onChange={(e) => handleIntervalChange(parseInt(e.target.value, 10))}>
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
                if (Number.isFinite(n)) handleMaxRetainedChange(n)
              }}
            />
          </div>
        </div>

        {cloudMsg && (
          <p
            className={cn(
              'mt-3 text-xs',
              cloudMsg.kind === 'ok' ? 'text-emerald-600' : 'text-destructive',
            )}>
            {cloudMsg.text}
          </p>
        )}
      </div>

      <BackupHistoryDialog open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </>
  )
}
