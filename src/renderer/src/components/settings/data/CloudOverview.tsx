import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { PasswordInput } from '@renderer/components/ui/password-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'
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
 *   - sync encryption passphrase (shared across both remotes; persists across
 *     sessions so the user fills it once and never re-enters)
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
  // Use saveSettings (optimistic-update) instead of window.api.setSetting for
  // any field bound to the settings store. The raw IPC's broadcast EXCLUDES
  // the originating window, so the store would never see the new value and
  // controlled inputs (like the max-retained number spinner) would snap back
  // to the old value on every click — making them appear unresponsive.
  const saveSettings = useSettingsStore((s) => s.saveSettings)

  const [cloudMsg, setCloudMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [passphraseInput, setPassphraseInput] = useState('')
  const [savingPassphrase, setSavingPassphrase] = useState(false)

  const anyConfigured = !!(remoteConfigs.webdav || remoteConfigs.s3)
  const interval = status?.autoSyncIntervalMinutes ?? 0
  const maxRetained = parseInt(maxRetainedSetting ?? '5', 10)
  const hasPassphrase = status?.hasPassphrase ?? false

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
    const ok = await saveSettings({ 'backup.maxRetainedBackups': String(clamped) })
    if (!ok) {
      const err = useSettingsStore.getState().error
      if (err) setCloudMsg({ kind: 'err', text: localizedError(err) })
    }
  }

  const handleSavePassphrase = async (): Promise<void> => {
    if (!passphraseInput || savingPassphrase) return
    setCloudMsg(null)
    setSavingPassphrase(true)
    try {
      const r = await window.api.setSetting('backup.syncPassphrase', passphraseInput)
      if (!r.success) {
        setCloudMsg({ kind: 'err', text: localizedError(r.error) })
        return
      }
      // Refresh status so the "configured" badge picks up the new value —
      // setSetting's settings:changed broadcast doesn't echo back to the
      // sender, and SyncStatus.hasPassphrase derives from that setting in
      // the main process.
      await loadStatus()
      setPassphraseInput('')
      setCloudMsg({ kind: 'ok', text: t('settings.data.cloud.passphraseSaved') })
    } finally {
      setSavingPassphrase(false)
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

        <div className="mt-4 grid gap-1.5 border-t pt-4">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">{t('settings.backup.passphrase')}</Label>
            {hasPassphrase && (
              <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600">
                {t('settings.data.cloud.configuredBadge')}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <PasswordInput
                placeholder={
                  hasPassphrase
                    ? t('settings.backup.passphrasePlaceholderUpdate')
                    : t('settings.backup.passphrasePlaceholderNew')
                }
                value={passphraseInput}
                onChange={(e) => setPassphraseInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSavePassphrase()
                  }
                }}
              />
            </div>
            <Button
              variant="secondary"
              onClick={handleSavePassphrase}
              disabled={!passphraseInput || savingPassphrase}>
              {hasPassphrase ? t('settings.backup.passphraseUpdate') : t('common.save')}
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">{t('settings.backup.passphraseHint')}</p>
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
          <div className="grid gap-1.5">
            <Label className="text-xs">{t('settings.backup.intervalLabel')}</Label>
            <Select
              value={String(interval)}
              onValueChange={(v) => handleIntervalChange(parseInt(v, 10))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">{t('settings.backup.intervalOff')}</SelectItem>
                <SelectItem value="15">{t('settings.backup.interval15')}</SelectItem>
                <SelectItem value="30">{t('settings.backup.interval30')}</SelectItem>
                <SelectItem value="60">{t('settings.backup.interval60')}</SelectItem>
                <SelectItem value="180">{t('settings.backup.interval180')}</SelectItem>
                <SelectItem value="720">{t('settings.backup.interval720')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">{t('settings.backup.maxRetainedLabel')}</Label>
            <Input
              type="number"
              min={1}
              max={50}
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
