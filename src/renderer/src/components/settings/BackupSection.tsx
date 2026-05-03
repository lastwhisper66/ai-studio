import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import { Label } from '@renderer/components/ui/label'
import { useBackupStore } from '@renderer/stores/backupStore'
import { useLocalizedError } from '@renderer/hooks/useLocalizedError'
import { cn } from '@renderer/lib/utils'
import { ERROR_CODES } from '@shared/errors'
import type { BackupFileMeta, BackupImportMode } from '@shared/types'
import { BackupPasswordDialog } from './BackupPasswordDialog'

export function BackupSection(): React.JSX.Element {
  const { t } = useTranslation()
  const localizedError = useLocalizedError()
  const exportToFile = useBackupStore((s) => s.exportToFile)
  const importFromFile = useBackupStore((s) => s.importFromFile)
  const peekFile = useBackupStore((s) => s.peekFile)

  const [importMode, setImportMode] = useState<BackupImportMode>('replace')
  const [exportOpen, setExportOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [pendingFilePath, setPendingFilePath] = useState<string | undefined>(undefined)
  const [peekMeta, setPeekMeta] = useState<BackupFileMeta | null>(null)
  const [pwError, setPwError] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-xl border bg-card/50 p-5">
        <h2 className="text-base font-semibold">{t('settings.backup.title')}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t('settings.backup.description')}</p>
      </div>

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

      {/* Cloud sync placeholder — fleshed out in Phase 4/5 */}
      <div className="rounded-xl border bg-card/50 p-5">
        <h3 className="text-sm font-semibold">{t('settings.backup.cloudTitle')}</h3>
        <p className="text-xs text-muted-foreground mt-1">{t('settings.backup.cloudComingSoon')}</p>
      </div>

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
