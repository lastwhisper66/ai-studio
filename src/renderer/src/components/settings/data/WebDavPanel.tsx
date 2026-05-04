import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Cloud } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { PasswordInput } from '@renderer/components/ui/password-input'
import { Label } from '@renderer/components/ui/label'
import { Switch } from '@renderer/components/ui/switch'
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
import type { WebDavRemoteConfig } from '@shared/types'
import { BackupHistoryDialog } from '../BackupHistoryDialog'

type Msg = { kind: 'ok' | 'err' | 'info'; text: string } | null

/**
 * WebDAV detail page — credentials form, sync status panel, sync options
 * (passphrase / interval / retention) all in one place. Independent of S3.
 */
export function WebDavPanel(): React.JSX.Element {
  const initial = useBackupStore((s) => s.remoteConfigs.webdav)
  // The key encodes the persisted shape; whenever the user saves or clears
  // the remote, the key flips and the inner form re-mounts with the fresh
  // initial values. Form-field edits don't change the key, so typing isn't
  // disrupted.
  const formKey = initial
    ? `cfg-${initial.url}-${initial.username}-${initial.subPath}`
    : 'cfg-empty'
  return <WebDavPage key={formKey} initial={initial} />
}

function WebDavPage({ initial }: { initial: WebDavRemoteConfig | null }): React.JSX.Element {
  const { t } = useTranslation()
  const localizedError = useLocalizedError()

  const status = useBackupStore((s) => s.status?.remotes.webdav ?? null)
  const setRemoteConfig = useBackupStore((s) => s.setRemoteConfig)
  const clearRemoteConfig = useBackupStore((s) => s.clearRemoteConfig)
  const testRemote = useBackupStore((s) => s.testRemote)
  const syncNow = useBackupStore((s) => s.syncNow)
  const cancelSync = useBackupStore((s) => s.cancelSync)
  const setRemoteEnabled = useBackupStore((s) => s.setRemoteEnabled)
  const saveSettings = useSettingsStore((s) => s.saveSettings)

  const passphrase = useSettingsStore((s) => s.settings['backup.remote.webdav.passphrase']) ?? ''
  const intervalSetting =
    useSettingsStore((s) => s.settings['backup.remote.webdav.autoSyncIntervalMinutes']) ?? '0'
  const maxRetainedSetting =
    useSettingsStore((s) => s.settings['backup.remote.webdav.maxRetainedBackups']) ?? '5'

  // Credential form local state
  const [url, setUrl] = useState(initial?.url ?? '')
  const [username, setUsername] = useState(initial?.username ?? '')
  const [password, setPassword] = useState(initial?.password ?? '')
  const [subPath, setSubPath] = useState(initial?.subPath ?? '')
  const [testing, setTesting] = useState(false)
  const [testOk, setTestOk] = useState(false)
  const [credMsg, setCredMsg] = useState<Msg>(null)
  const [saving, setSaving] = useState(false)

  // Sync option local state (for passphrase input)
  const [pp, setPp] = useState(passphrase)
  const [syncMsg, setSyncMsg] = useState<Msg>(null)

  // History dialog
  const [historyOpen, setHistoryOpen] = useState(false)

  const buildCfg = (): WebDavRemoteConfig => ({
    type: 'webdav',
    url,
    username,
    password,
    subPath,
  })

  const invalidateTest = (): void => {
    if (testOk) setTestOk(false)
    if (credMsg?.kind === 'ok') setCredMsg(null)
  }

  const doTest = async (): Promise<void> => {
    setTesting(true)
    setCredMsg(null)
    setTestOk(false)
    const r = await testRemote(buildCfg())
    setTesting(false)
    if (r.ok) {
      setTestOk(true)
      setCredMsg({
        kind: 'ok',
        text: t('settings.backup.remote.testOk', { latency: r.latency ?? 0 }),
      })
    } else if (r.error) {
      setCredMsg({ kind: 'err', text: localizedError(r.error) })
    }
  }

  const doSave = async (): Promise<void> => {
    if (!testOk || saving) return
    setSaving(true)
    const r = await setRemoteConfig(buildCfg())
    setSaving(false)
    if (r && 'error' in r) {
      setCredMsg({ kind: 'err', text: localizedError(r.error) })
      return
    }
    setCredMsg({ kind: 'ok', text: t('settings.data.cloud.saveOk') })
  }

  const doClear = async (): Promise<void> => {
    setCredMsg(null)
    await clearRemoteConfig('webdav')
  }

  const handleSyncNow = async (): Promise<void> => {
    setSyncMsg(null)
    const r = await syncNow('webdav')
    if ('error' in r) {
      setSyncMsg({ kind: 'err', text: localizedError(r.error) })
      return
    }
    setSyncMsg({ kind: 'ok', text: t(`settings.backup.syncResult.${r.direction}`) })
  }

  const handleSavePassphrase = async (): Promise<void> => {
    setSyncMsg(null)
    const ok = await saveSettings({ 'backup.remote.webdav.passphrase': pp })
    if (!ok) {
      const err = useSettingsStore.getState().error
      if (err) setSyncMsg({ kind: 'err', text: localizedError(err) })
      return
    }
    setSyncMsg({ kind: 'ok', text: t('settings.data.cloud.passphraseSaved') })
  }

  const handleIntervalChange = async (minutes: number): Promise<void> => {
    setSyncMsg(null)
    const ok = await saveSettings({
      'backup.remote.webdav.autoSyncIntervalMinutes': String(minutes),
    })
    if (!ok) {
      const err = useSettingsStore.getState().error
      if (err) setSyncMsg({ kind: 'err', text: localizedError(err) })
    }
  }

  const handleMaxRetainedChange = async (n: number): Promise<void> => {
    setSyncMsg(null)
    const clamped = Math.max(1, Math.min(50, n || 5))
    const ok = await saveSettings({
      'backup.remote.webdav.maxRetainedBackups': String(clamped),
    })
    if (!ok) {
      const err = useSettingsStore.getState().error
      if (err) setSyncMsg({ kind: 'err', text: localizedError(err) })
    }
  }

  const handleEnableToggle = async (enabled: boolean): Promise<void> => {
    setSyncMsg(null)
    const r = await setRemoteEnabled('webdav', enabled)
    if (r && 'error' in r) {
      setSyncMsg({ kind: 'err', text: localizedError(r.error) })
    }
  }

  const interval = parseInt(intervalSetting, 10)
  const maxRetained = parseInt(maxRetainedSetting, 10)

  return (
    <>
      {/* Header */}
      <div className="bg-card/50 rounded-xl border p-5">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-lg">
            <Cloud className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold">{t('settings.data.cloud.webdavTitle')}</h2>
            <p className="text-muted-foreground text-xs">
              {t('settings.data.cloud.webdavHint')}
              {initial && (
                <span className="ml-2 inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600">
                  {t('settings.data.cloud.configuredBadge')}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="webdav-enabled" className="text-xs">
              {t('settings.data.cloud.enableLabel')}
            </Label>
            <Switch
              id="webdav-enabled"
              checked={!!status?.enabled}
              onCheckedChange={handleEnableToggle}
              disabled={!status?.configured}
            />
          </div>
        </div>
      </div>

      {/* Sync status */}
      {status?.configured && (
        <div className="bg-card/50 rounded-xl border p-5">
          <h3 className="text-sm font-semibold">{t('settings.data.cloud.statusSection')}</h3>
          <div className="text-muted-foreground mt-3 flex flex-col gap-1 text-xs">
            {status.lastSyncedAt && (
              <span>
                {t('settings.backup.lastSynced', {
                  at: new Date(status.lastSyncedAt).toLocaleString(),
                })}
              </span>
            )}
            {status.lastError && (
              <span className="text-destructive">{localizedError(status.lastError)}</span>
            )}
            {status.lastWarning && !status.lastError && (
              <span className="text-amber-600">{status.lastWarning}</span>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={handleSyncNow} disabled={!status.enabled || status.isSyncing}>
              {status.isSyncing ? t('settings.backup.syncing') : t('settings.backup.syncNowButton')}
            </Button>
            {status.isSyncing && (
              <Button variant="outline" onClick={() => cancelSync('webdav')}>
                {t('common.cancel')}
              </Button>
            )}
            <Button variant="outline" onClick={() => setHistoryOpen(true)}>
              {t('settings.backup.historyButton')}
            </Button>
          </div>
        </div>
      )}

      {/* Credentials */}
      <div className="bg-card/50 rounded-xl border p-5">
        <h3 className="text-sm font-semibold">{t('settings.data.cloud.credentialsSection')}</h3>
        <div className="mt-3 grid gap-3">
          <Field
            label={t('settings.backup.remote.webdav.url')}
            placeholder="https://dav.jianguoyun.com/dav/"
            value={url}
            onChange={(v) => {
              setUrl(v)
              invalidateTest()
            }}
          />
          <Field
            label={t('settings.backup.remote.webdav.username')}
            value={username}
            onChange={(v) => {
              setUsername(v)
              invalidateTest()
            }}
          />
          <PasswordField
            label={t('settings.backup.remote.webdav.password')}
            value={password}
            onChange={(v) => {
              setPassword(v)
              invalidateTest()
            }}
          />
          <Field
            label={t('settings.backup.remote.webdav.subPath')}
            optional
            hint={t('settings.backup.remote.webdav.subPathHint')}
            placeholder={t('settings.backup.remote.webdav.subPathPlaceholder')}
            value={subPath}
            onChange={(v) => {
              setSubPath(v)
              invalidateTest()
            }}
          />
        </div>

        {credMsg && (
          <p
            className={cn(
              'mt-3 text-xs',
              credMsg.kind === 'ok'
                ? 'text-emerald-600'
                : credMsg.kind === 'info'
                  ? 'text-muted-foreground'
                  : 'text-destructive',
            )}>
            {credMsg.text}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={doTest} disabled={testing}>
            {testing ? t('settings.backup.remote.testing') : t('settings.backup.remote.testButton')}
          </Button>
          <Button onClick={doSave} disabled={!testOk || saving}>
            {t('common.save')}
          </Button>
          {initial && (
            <Button variant="ghost" onClick={doClear}>
              {t('settings.data.cloud.clearButton')}
            </Button>
          )}
        </div>
      </div>

      {/* Sync options (per-remote) */}
      <div className="bg-card/50 rounded-xl border p-5">
        <h3 className="text-sm font-semibold">{t('settings.data.cloud.syncOptionsSection')}</h3>
        <p className="text-muted-foreground mt-1 text-xs">
          {t('settings.data.cloud.syncOptionsScope', { remote: 'WebDAV' })}
        </p>

        <div className="mt-4 grid gap-3">
          <div className="grid gap-1.5">
            <Label className="text-xs">{t('settings.backup.passphraseLabel')}</Label>
            <div className="flex gap-2">
              <PasswordInput
                placeholder={t('settings.backup.passphrasePlaceholderOptional')}
                value={pp}
                onChange={(e) => setPp(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSavePassphrase()
                  }
                }}
              />
              <Button
                variant="secondary"
                onClick={handleSavePassphrase}
                disabled={pp === passphrase}>
                {passphrase ? t('settings.backup.passphraseUpdate') : t('common.save')}
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              {t('settings.backup.passphraseHintOptional')}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
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
        </div>

        {syncMsg && (
          <p
            className={cn(
              'mt-3 text-xs',
              syncMsg.kind === 'ok'
                ? 'text-emerald-600'
                : syncMsg.kind === 'info'
                  ? 'text-muted-foreground'
                  : 'text-destructive',
            )}>
            {syncMsg.text}
          </p>
        )}
      </div>

      <BackupHistoryDialog
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        remoteType="webdav"
      />
    </>
  )
}

function Field(props: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  optional?: boolean
  hint?: string
}): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">
        {props.label}
        {props.optional && (
          <span className="text-muted-foreground ml-1 font-normal">
            {t('settings.backup.remote.optional')}
          </span>
        )}
      </Label>
      <Input
        placeholder={props.placeholder}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
      {props.hint && <p className="text-muted-foreground text-xs">{props.hint}</p>}
    </div>
  )
}

function PasswordField(props: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}): React.JSX.Element {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{props.label}</Label>
      <PasswordInput
        placeholder={props.placeholder}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </div>
  )
}
