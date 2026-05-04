import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { PasswordInput } from '@renderer/components/ui/password-input'
import { Label } from '@renderer/components/ui/label'
import { Switch } from '@renderer/components/ui/switch'
import { useBackupStore } from '@renderer/stores/backupStore'
import { useLocalizedError } from '@renderer/hooks/useLocalizedError'
import { cn } from '@renderer/lib/utils'
import type { S3RemoteConfig } from '@shared/types'

/**
 * S3-compatible storage configuration panel — inline form (replaces the old
 * dialog). Same Test→Save gating as the WebDAV panel; same shared sync
 * passphrase. Configuring this AND WebDAV simultaneously is supported — the
 * sync-engine will mirror writes to both remotes.
 *
 * Wrapper re-mounts the inner form via `key` whenever the persisted config
 * changes (save/clear). See WebDavPanel.tsx for the same pattern's rationale.
 */
export function S3Panel(): React.JSX.Element {
  const initial = useBackupStore((s) => s.remoteConfigs.s3)
  const formKey = initial
    ? `cfg-${initial.endpoint}-${initial.bucket}-${initial.region}-${initial.accessKeyId}`
    : 'cfg-empty'
  return <S3Form key={formKey} initial={initial} />
}

function S3Form({ initial }: { initial: S3RemoteConfig | null }): React.JSX.Element {
  const { t } = useTranslation()
  const localizedError = useLocalizedError()
  const setRemoteConfig = useBackupStore((s) => s.setRemoteConfig)
  const clearRemoteConfig = useBackupStore((s) => s.clearRemoteConfig)
  const testRemote = useBackupStore((s) => s.testRemote)

  const [endpoint, setEndpoint] = useState(initial?.endpoint ?? '')
  const [region, setRegion] = useState(initial?.region || 'auto')
  const [bucket, setBucket] = useState(initial?.bucket ?? '')
  const [accessKeyId, setAccessKeyId] = useState(initial?.accessKeyId ?? '')
  const [secretAccessKey, setSecretAccessKey] = useState(initial?.secretAccessKey ?? '')
  const [forcePathStyle, setForcePathStyle] = useState(initial?.forcePathStyle ?? true)
  const [prefix, setPrefix] = useState(initial?.prefix || 'aistudio-backup')
  const [passphrase, setPassphrase] = useState('')

  const [testing, setTesting] = useState(false)
  const [testOk, setTestOk] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const buildCfg = (): S3RemoteConfig => ({
    type: 's3',
    endpoint,
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    forcePathStyle,
    prefix,
  })

  const invalidateTest = (): void => {
    if (testOk) setTestOk(false)
    if (msg?.kind === 'ok') setMsg(null)
  }

  const doTest = async (): Promise<void> => {
    setTesting(true)
    setMsg(null)
    setTestOk(false)
    const r = await testRemote(buildCfg())
    setTesting(false)
    if (r.ok) {
      setTestOk(true)
      setMsg({
        kind: 'ok',
        text: t('settings.backup.remote.testOk', { latency: r.latency ?? 0 }),
      })
    } else if (r.error) {
      setMsg({ kind: 'err', text: localizedError(r.error) })
    }
  }

  const doSave = async (): Promise<void> => {
    if (!testOk || saving) return
    if (!initial && !passphrase) {
      setMsg({ kind: 'err', text: t('settings.backup.remote.passphraseRequired') })
      return
    }
    setSaving(true)
    const r = await setRemoteConfig(buildCfg(), passphrase || undefined)
    setSaving(false)
    if (r && 'error' in r) {
      setMsg({ kind: 'err', text: localizedError(r.error) })
      return
    }
    setMsg({ kind: 'ok', text: t('settings.data.cloud.saveOk') })
  }

  const doClear = async (): Promise<void> => {
    setMsg(null)
    await clearRemoteConfig('s3')
    // Re-mount happens automatically (parent key flips).
  }

  return (
    <div className="bg-card/50 space-y-4 rounded-xl border p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{t('settings.data.cloud.s3Title')}</h3>
          <p className="text-muted-foreground mt-1 text-xs">
            {t('settings.data.cloud.s3Hint')}
            {initial && (
              <span className="ml-2 inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600">
                {t('settings.data.cloud.configuredBadge')}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        <Field
          label={t('settings.backup.remote.s3.endpoint')}
          placeholder="https://<account>.r2.cloudflarestorage.com"
          value={endpoint}
          onChange={(v) => {
            setEndpoint(v)
            invalidateTest()
          }}
        />
        <Field
          label={t('settings.backup.remote.s3.region')}
          value={region}
          onChange={(v) => {
            setRegion(v)
            invalidateTest()
          }}
        />
        <Field
          label={t('settings.backup.remote.s3.bucket')}
          value={bucket}
          onChange={(v) => {
            setBucket(v)
            invalidateTest()
          }}
        />
        <Field
          label={t('settings.backup.remote.s3.accessKeyId')}
          value={accessKeyId}
          onChange={(v) => {
            setAccessKeyId(v)
            invalidateTest()
          }}
        />
        <PasswordField
          label={t('settings.backup.remote.s3.secretAccessKey')}
          value={secretAccessKey}
          onChange={(v) => {
            setSecretAccessKey(v)
            invalidateTest()
          }}
        />
        <Field
          label={t('settings.backup.remote.s3.prefix')}
          placeholder="aistudio-backup"
          value={prefix}
          onChange={(v) => {
            setPrefix(v)
            invalidateTest()
          }}
        />
        <div className="flex items-center justify-between">
          <Label htmlFor="s-path" className="text-sm font-normal">
            {t('settings.backup.remote.s3.forcePathStyle')}
          </Label>
          <Switch
            id="s-path"
            checked={forcePathStyle}
            onCheckedChange={(v) => {
              setForcePathStyle(v)
              invalidateTest()
            }}
          />
        </div>
      </div>

      <div className="grid gap-1.5 border-t pt-4">
        <Label className="text-xs">{t('settings.backup.remote.passphrase')}</Label>
        <PasswordInput
          placeholder={
            initial
              ? t('settings.backup.remote.passphrasePlaceholderKeep')
              : t('settings.backup.remote.passphrasePlaceholderNew')
          }
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
        />
        <p className="text-muted-foreground text-xs">
          {t('settings.backup.remote.passphraseHint')}
        </p>
      </div>

      {msg && (
        <p
          className={cn(
            'text-xs',
            msg.kind === 'ok'
              ? 'text-emerald-600'
              : msg.kind === 'info'
                ? 'text-muted-foreground'
                : 'text-destructive',
          )}>
          {msg.text}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
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
  )
}

function Field(props: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}): React.JSX.Element {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{props.label}</Label>
      <Input
        type={props.type ?? 'text'}
        placeholder={props.placeholder}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
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
