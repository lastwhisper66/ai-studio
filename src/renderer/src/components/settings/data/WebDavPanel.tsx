import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { PasswordInput } from '@renderer/components/ui/password-input'
import { Label } from '@renderer/components/ui/label'
import { useBackupStore } from '@renderer/stores/backupStore'
import { useLocalizedError } from '@renderer/hooks/useLocalizedError'
import { cn } from '@renderer/lib/utils'
import type { WebDavRemoteConfig } from '@shared/types'

/**
 * WebDAV configuration panel — inline form (replaces the old dialog). The
 * user must press "Test connection" before "Save" becomes enabled, so a
 * remote config can never be persisted with credentials that don't actually
 * work.
 *
 * The sync passphrase encrypts every snapshot uploaded to the cloud and is
 * SHARED across both WebDAV and S3 (so a snapshot uploaded to one can be
 * decrypted from the other). Leaving the passphrase blank when saving means
 * "keep the previously-saved one".
 *
 * The wrapper picks up the persisted config from the store and re-mounts
 * the inner form whenever that config changes — that's how the form fields
 * stay in sync with saves/clears without resorting to a setState-in-effect
 * (which the lint rules forbid).
 */
export function WebDavPanel(): React.JSX.Element {
  const initial = useBackupStore((s) => s.remoteConfigs.webdav)
  // The key encodes the persisted shape; whenever the user saves or clears
  // the remote, the key flips and the inner form re-mounts with the fresh
  // initial values. Form-field edits don't change the key (they live in
  // local state inside the inner form), so typing isn't disrupted.
  const formKey = initial
    ? `cfg-${initial.url}-${initial.username}-${initial.subPath}`
    : 'cfg-empty'
  return <WebDavForm key={formKey} initial={initial} />
}

function WebDavForm({ initial }: { initial: WebDavRemoteConfig | null }): React.JSX.Element {
  const { t } = useTranslation()
  const localizedError = useLocalizedError()
  const setRemoteConfig = useBackupStore((s) => s.setRemoteConfig)
  const clearRemoteConfig = useBackupStore((s) => s.clearRemoteConfig)
  const testRemote = useBackupStore((s) => s.testRemote)

  const [url, setUrl] = useState(initial?.url ?? '')
  const [username, setUsername] = useState(initial?.username ?? '')
  const [password, setPassword] = useState(initial?.password ?? '')
  const [subPath, setSubPath] = useState(initial?.subPath || 'aistudio-backup')
  const [passphrase, setPassphrase] = useState('')

  const [testing, setTesting] = useState(false)
  const [testOk, setTestOk] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const buildCfg = (): WebDavRemoteConfig => ({
    type: 'webdav',
    url,
    username,
    password,
    subPath,
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
    await clearRemoteConfig('webdav')
    // Re-mount happens automatically (the parent's key flips), so no need
    // to manually reset local state here.
  }

  return (
    <div className="bg-card/50 space-y-4 rounded-xl border p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{t('settings.data.cloud.webdavTitle')}</h3>
          <p className="text-muted-foreground mt-1 text-xs">
            {t('settings.data.cloud.webdavHint')}
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
          placeholder="aistudio-backup"
          value={subPath}
          onChange={(v) => {
            setSubPath(v)
            invalidateTest()
          }}
        />
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
