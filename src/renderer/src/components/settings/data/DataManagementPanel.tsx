import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload, Download, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Label } from '@renderer/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@renderer/components/ui/alert-dialog'
import { useBackupStore } from '@renderer/stores/backupStore'
import { useLocalizedError } from '@renderer/hooks/useLocalizedError'
import { cn } from '@renderer/lib/utils'
import { ERROR_CODES } from '@shared/errors'
import type { BackupImportMode } from '@shared/types'
import { BackupRollbackDialog } from '../BackupRollbackDialog'

/**
 * Unified data-management page — local export/import, rollback access, and the
 * destructive "clear all data" control.
 *
 * Backup files are always plaintext; export and import are direct one-click
 * actions with no password dialog. Encrypted legacy files (if any) are
 * rejected by the codec as `BACKUP_FILE_INVALID`.
 */
export function DataManagementPanel(): React.JSX.Element {
  const { t } = useTranslation()
  const localizedError = useLocalizedError()
  const exportToFile = useBackupStore((s) => s.exportToFile)
  const importFromFile = useBackupStore((s) => s.importFromFile)

  const [importMode, setImportMode] = useState<BackupImportMode>('replace')
  const [statusMsg, setStatusMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [rollbackOpen, setRollbackOpen] = useState(false)
  const [clearError, setClearError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleExport = async (): Promise<void> => {
    setStatusMsg(null)
    setBusy(true)
    try {
      const r = await exportToFile()
      if ('error' in r) {
        if (r.error.code !== ERROR_CODES.BACKUP_CANCELLED) {
          setStatusMsg({ kind: 'err', text: localizedError(r.error) })
        }
        return
      }
      setStatusMsg({ kind: 'ok', text: t('settings.backup.exportSuccess', { path: r.filePath }) })
    } finally {
      setBusy(false)
    }
  }

  const handleImport = async (): Promise<void> => {
    setStatusMsg(null)
    const pickResult = await window.api.backup.pickFile()
    if (!pickResult.success) {
      setStatusMsg({ kind: 'err', text: localizedError(pickResult.error) })
      return
    }
    if (!pickResult.data) return
    setBusy(true)
    try {
      const r = await importFromFile(pickResult.data.filePath, importMode)
      if ('error' in r) {
        setStatusMsg({ kind: 'err', text: localizedError(r.error) })
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
    } finally {
      setBusy(false)
    }
  }

  const handleClearData = async (): Promise<void> => {
    try {
      setClearError(null)
      const result = await window.api.clearAppData()
      if (!result.success) {
        setClearError(
          result.error ? t(result.error.code, result.error.params ?? {}) : 'Failed to clear data',
        )
      }
    } catch (e) {
      setClearError((e as Error).message)
    }
  }

  return (
    <>
      <div className="bg-card/50 rounded-xl border p-5">
        <h2 className="text-base font-semibold">{t('settings.data.dataManagement.title')}</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {t('settings.data.dataManagement.description')}
        </p>
      </div>

      <div className="bg-card/50 divide-y rounded-xl border">
        <ActionRow
          icon={<Upload className="h-5 w-5" />}
          title={t('settings.backup.exportCard.title')}
          description={t('settings.backup.exportCard.description')}
          action={
            <Button onClick={handleExport} disabled={busy}>
              {t('settings.backup.exportButton')}
            </Button>
          }
        />

        <ActionRow
          icon={<Download className="h-5 w-5" />}
          title={t('settings.backup.importCard.title')}
          description={t('settings.backup.importCard.description')}
          belowDescription={
            <div className="flex flex-wrap items-center gap-2">
              <Label className="text-muted-foreground text-xs">
                {t('settings.backup.importMode')}
              </Label>
              <div className="flex gap-1">
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
              <span className="text-muted-foreground/80 text-xs">
                {importMode === 'replace'
                  ? t('settings.backup.modeReplaceHint')
                  : t('settings.backup.modeMergeHint')}
              </span>
            </div>
          }
          action={
            <Button variant="outline" onClick={handleImport} disabled={busy}>
              {t('settings.backup.importButton')}
            </Button>
          }
        />

        <ActionRow
          icon={<RotateCcw className="h-5 w-5" />}
          title={t('settings.backup.rollbackCard.title')}
          description={t('settings.backup.rollbackCard.description')}
          action={
            <Button
              variant="outline"
              onClick={() => {
                setStatusMsg(null)
                setRollbackOpen(true)
              }}>
              {t('settings.backup.rollback.button')}
            </Button>
          }
        />
      </div>

      {statusMsg && (
        <div className="bg-card/50 rounded-xl border p-4">
          <p
            className={cn(
              'text-xs',
              statusMsg.kind === 'ok' ? 'text-emerald-600' : 'text-destructive',
            )}>
            {statusMsg.text}
          </p>
        </div>
      )}

      {/* Danger zone */}
      <div className="border-destructive/40 bg-destructive/5 rounded-xl border p-5">
        <h3 className="text-destructive text-sm font-semibold">
          {t('settings.data.dangerZone.title')}
        </h3>
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Trash2 className="text-destructive mt-0.5 size-4 shrink-0" />
            <div>
              <Label className="text-sm font-medium">{t('settings.data.clearData')}</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {t('settings.data.clearDataDescription')}
              </p>
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                {t('settings.data.clearData')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('settings.data.clearDataConfirmTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('settings.data.clearDataConfirmDescription')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearData} variant="destructive">
                  {t('settings.data.clearDataConfirmButton')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        {clearError && <p className="text-destructive mt-2 text-xs">{clearError}</p>}
      </div>

      <BackupRollbackDialog open={rollbackOpen} onClose={() => setRollbackOpen(false)} />
    </>
  )
}

function ActionRow({
  icon,
  title,
  description,
  belowDescription,
  action,
}: {
  icon: React.ReactNode
  title: string
  description: string
  belowDescription?: React.ReactNode
  action: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-start gap-4 p-5">
      <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
        {icon}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
        </div>
        {belowDescription}
      </div>
      <div className="shrink-0 self-center">{action}</div>
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
        'rounded-md border px-2.5 py-1 text-xs transition-colors',
        active
          ? 'border-primary bg-primary/10 text-foreground'
          : 'border-border text-muted-foreground hover:bg-accent/50',
      )}>
      {label}
    </button>
  )
}
