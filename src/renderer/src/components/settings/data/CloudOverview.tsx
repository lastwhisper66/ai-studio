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

type CloudMessage = { kind: 'ok' | 'err'; text: string } | null

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
  // The settings store already holds the decrypted passphrase (getAllSettings
  // decrypts SENSITIVE_KEYS server-side), so the form can bind directly to
  // it. Keeping the value visible (masked) in the input — instead of clearing
  // it after save — gives the user persistent confirmation that a passphrase
  // is set.
  const storedPassphrase = useSettingsStore((s) => s.settings['backup.syncPassphrase']) ?? ''
  // Use saveSettings (optimistic-update) instead of window.api.setSetting for
  // any field bound to the settings store. The raw IPC's broadcast EXCLUDES
  // the originating window, so the store would never see the new value and
  // controlled inputs (like the max-retained number spinner) would snap back
  // to the old value on every click — making them appear unresponsive.
  const saveSettings = useSettingsStore((s) => s.saveSettings)

  const [cloudMsg, setCloudMsg] = useState<CloudMessage>(null)
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
    const ok = await saveSettings({ 'backup.maxRetainedBackups': String(clamped) })
    if (!ok) {
      const err = useSettingsStore.getState().error
      if (err) setCloudMsg({ kind: 'err', text: localizedError(err) })
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

        {/* The form's `key` flips between "set" and "unset" so a fresh
            settings-store load (or clearing the passphrase) re-mounts the
            inner form with the freshly-arrived initial value. Same key-based
            re-mount pattern as WebDavPanel / S3Panel. */}
        <PassphraseForm
          key={`pp-${storedPassphrase ? 'set' : 'unset'}`}
          initial={storedPassphrase}
          onMessage={setCloudMsg}
        />

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
                <SelectItem value="1">{t('settings.backup.interval1')}</SelectItem>
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

/**
 * Passphrase row — shows the saved passphrase (masked) so the user has
 * persistent visual confirmation that a value is stored. The button only
 * enables when the input diverges from `initial`; clicking it commits via
 * the optimistic-update `saveSettings` path so the store refreshes
 * immediately.
 *
 * `initial` is the saved cleartext, captured at mount time via the parent's
 * key-based remount. After a save the parent's `storedPassphrase` updates,
 * the `initial` prop here updates on the next render, and `isDirty` flips
 * to false — disabling the button as the in-place "saved" affordance.
 */
function PassphraseForm({
  initial,
  onMessage,
}: {
  initial: string
  onMessage: (m: CloudMessage) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const localizedError = useLocalizedError()
  const saveSettings = useSettingsStore((s) => s.saveSettings)

  const [input, setInput] = useState(initial)
  const [saving, setSaving] = useState(false)

  const hasStored = !!initial
  const isDirty = input !== initial

  const handleSave = async (): Promise<void> => {
    if (!isDirty || !input || saving) return
    onMessage(null)
    setSaving(true)
    try {
      const ok = await saveSettings({ 'backup.syncPassphrase': input })
      if (!ok) {
        const err = useSettingsStore.getState().error
        if (err) onMessage({ kind: 'err', text: localizedError(err) })
        return
      }
      onMessage({ kind: 'ok', text: t('settings.data.cloud.passphraseSaved') })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-4 grid gap-1.5 border-t pt-4">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">{t('settings.backup.passphrase')}</Label>
        {hasStored && (
          <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600">
            {t('settings.data.cloud.configuredBadge')}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <PasswordInput
            placeholder={t('settings.backup.passphrasePlaceholderNew')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleSave()
              }
            }}
          />
        </div>
        <Button variant="secondary" onClick={handleSave} disabled={!isDirty || !input || saving}>
          {hasStored ? t('settings.backup.passphraseUpdate') : t('common.save')}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">{t('settings.backup.passphraseHint')}</p>
    </div>
  )
}
