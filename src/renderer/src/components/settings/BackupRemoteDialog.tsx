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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Switch } from '@renderer/components/ui/switch'
import { Button } from '@renderer/components/ui/button'
import { useBackupStore } from '@renderer/stores/backupStore'
import { useLocalizedError } from '@renderer/hooks/useLocalizedError'
import type { RemoteConfig } from '@shared/types'

export interface BackupRemoteDialogProps {
  open: boolean
  initial: RemoteConfig | null
  onCancel: () => void
  onSaved: () => void
}

/**
 * Configure the cloud-backup destination (WebDAV or S3-compatible).
 *
 * UX contract:
 * 1. User fills the form for either WebDAV or an S3-compatible bucket.
 * 2. They MUST press "Test connection" first — Save is gated until the round-trip
 *    succeeds. This forces credentials to be validated before they're persisted,
 *    which avoids storing a config that can never sync.
 * 3. On Save, `setRemoteConfig` writes the form values via IPC; sensitive fields
 *    end up in safeStorage-encrypted settings rows.
 */
export function BackupRemoteDialog({
  open,
  initial,
  onCancel,
  onSaved,
}: BackupRemoteDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const localizedError = useLocalizedError()
  const setRemoteConfig = useBackupStore((s) => s.setRemoteConfig)
  const testRemote = useBackupStore((s) => s.testRemote)

  const [tab, setTab] = useState<'webdav' | 's3'>(initial?.type ?? 'webdav')
  const [testing, setTesting] = useState(false)
  const [testMsg, setTestMsg] = useState<string | null>(null)
  const [testOk, setTestOk] = useState(false)
  const [saving, setSaving] = useState(false)

  // WebDAV form state
  const [wUrl, setWUrl] = useState(initial?.type === 'webdav' ? initial.url : '')
  const [wUser, setWUser] = useState(initial?.type === 'webdav' ? initial.username : '')
  const [wPw, setWPw] = useState(initial?.type === 'webdav' ? initial.password : '')
  const [wSub, setWSub] = useState(initial?.type === 'webdav' ? initial.subPath : 'aistudio-backup')

  // S3 form state
  const [sEndpoint, setSEndpoint] = useState(initial?.type === 's3' ? initial.endpoint : '')
  const [sRegion, setSRegion] = useState(initial?.type === 's3' ? initial.region : 'auto')
  const [sBucket, setSBucket] = useState(initial?.type === 's3' ? initial.bucket : '')
  const [sAk, setSAk] = useState(initial?.type === 's3' ? initial.accessKeyId : '')
  const [sSk, setSSk] = useState(initial?.type === 's3' ? initial.secretAccessKey : '')
  const [sPath, setSPath] = useState(initial?.type === 's3' ? initial.forcePathStyle : true)
  const [sPrefix, setSPrefix] = useState(
    initial?.type === 's3' ? initial.prefix : 'aistudio-backup',
  )

  // Reset transient state every time the dialog opens, and rehydrate the
  // tab from `initial`. Form fields are kept across opens (initial values
  // applied by useState init) — switching tabs preserves user typing within
  // a single dialog session.
  useEffect(() => {
    if (open) {
      setTab(initial?.type ?? 'webdav')
      setTesting(false)
      setTestMsg(null)
      setTestOk(false)
      setSaving(false)
    }
  }, [open, initial])

  // Any field edit invalidates the previous "test passed" state, forcing the
  // user to re-test before Save becomes available.
  const invalidateTest = (): void => {
    if (testOk) setTestOk(false)
    if (testMsg) setTestMsg(null)
  }

  const buildCfg = (): RemoteConfig =>
    tab === 'webdav'
      ? { type: 'webdav', url: wUrl, username: wUser, password: wPw, subPath: wSub }
      : {
          type: 's3',
          endpoint: sEndpoint,
          region: sRegion,
          bucket: sBucket,
          accessKeyId: sAk,
          secretAccessKey: sSk,
          forcePathStyle: sPath,
          prefix: sPrefix,
        }

  const doTest = async (): Promise<void> => {
    setTesting(true)
    setTestMsg(null)
    setTestOk(false)
    const r = await testRemote(buildCfg())
    setTesting(false)
    if (r.ok) {
      setTestOk(true)
      setTestMsg(t('settings.backup.remote.testOk', { latency: r.latency ?? 0 }))
    } else if (r.error) {
      setTestMsg(localizedError(r.error))
    }
  }

  const doSave = async (): Promise<void> => {
    if (!testOk || saving) return
    setSaving(true)
    const r = await setRemoteConfig(buildCfg())
    setSaving(false)
    if (r && 'error' in r) {
      setTestMsg(localizedError(r.error))
      return
    }
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('settings.backup.remote.dialogTitle')}</DialogTitle>
          <DialogDescription>{t('settings.backup.remote.dialogDesc')}</DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v as 'webdav' | 's3')
            invalidateTest()
          }}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="webdav">WebDAV</TabsTrigger>
            <TabsTrigger value="s3">S3 / S3-Compatible</TabsTrigger>
          </TabsList>
          <TabsContent value="webdav" className="grid gap-3 pt-3">
            <Field
              label={t('settings.backup.remote.webdav.url')}
              placeholder="https://dav.jianguoyun.com/dav/"
              value={wUrl}
              onChange={(v) => {
                setWUrl(v)
                invalidateTest()
              }}
            />
            <Field
              label={t('settings.backup.remote.webdav.username')}
              value={wUser}
              onChange={(v) => {
                setWUser(v)
                invalidateTest()
              }}
            />
            <Field
              label={t('settings.backup.remote.webdav.password')}
              type="password"
              value={wPw}
              onChange={(v) => {
                setWPw(v)
                invalidateTest()
              }}
            />
            <Field
              label={t('settings.backup.remote.webdav.subPath')}
              placeholder="aistudio-backup"
              value={wSub}
              onChange={(v) => {
                setWSub(v)
                invalidateTest()
              }}
            />
          </TabsContent>
          <TabsContent value="s3" className="grid gap-3 pt-3">
            <Field
              label={t('settings.backup.remote.s3.endpoint')}
              placeholder="https://<account>.r2.cloudflarestorage.com"
              value={sEndpoint}
              onChange={(v) => {
                setSEndpoint(v)
                invalidateTest()
              }}
            />
            <Field
              label={t('settings.backup.remote.s3.region')}
              value={sRegion}
              onChange={(v) => {
                setSRegion(v)
                invalidateTest()
              }}
            />
            <Field
              label={t('settings.backup.remote.s3.bucket')}
              value={sBucket}
              onChange={(v) => {
                setSBucket(v)
                invalidateTest()
              }}
            />
            <Field
              label={t('settings.backup.remote.s3.accessKeyId')}
              value={sAk}
              onChange={(v) => {
                setSAk(v)
                invalidateTest()
              }}
            />
            <Field
              label={t('settings.backup.remote.s3.secretAccessKey')}
              type="password"
              value={sSk}
              onChange={(v) => {
                setSSk(v)
                invalidateTest()
              }}
            />
            <Field
              label={t('settings.backup.remote.s3.prefix')}
              placeholder="aistudio-backup"
              value={sPrefix}
              onChange={(v) => {
                setSPrefix(v)
                invalidateTest()
              }}
            />
            <div className="flex items-center justify-between">
              <Label htmlFor="s-path" className="text-sm font-normal">
                {t('settings.backup.remote.s3.forcePathStyle')}
              </Label>
              <Switch
                id="s-path"
                checked={sPath}
                onCheckedChange={(v) => {
                  setSPath(v)
                  invalidateTest()
                }}
              />
            </div>
          </TabsContent>
        </Tabs>

        {testMsg && (
          <p className={testOk ? 'text-emerald-600 text-xs' : 'text-destructive text-xs'}>
            {testMsg}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button variant="secondary" onClick={doTest} disabled={testing}>
            {testing ? t('settings.backup.remote.testing') : t('settings.backup.remote.testButton')}
          </Button>
          <Button onClick={doSave} disabled={!testOk || saving}>
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
