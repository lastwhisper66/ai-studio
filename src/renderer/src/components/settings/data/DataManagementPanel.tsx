import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Upload,
  Download,
  RotateCcw,
  Trash2,
  Settings as SettingsIcon,
  RefreshCw,
  Library as LibraryIcon,
} from 'lucide-react'
import { useAssistantTemplateStore } from '@renderer/stores/assistantTemplateStore'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
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
import { useConversationStore } from '@renderer/stores/conversationStore'
import { useLocalizedError } from '@renderer/hooks/useLocalizedError'
import { cn } from '@renderer/lib/utils'
import { ERROR_CODES } from '@shared/errors'
import type { BackupImportMode } from '@shared/types'
import { BackupRollbackDialog } from '../BackupRollbackDialog'

/**
 * localStorage keys owned by the renderer. Cleared before "clear all settings"
 * and "reset app" so the app returns to first-launch UI state.
 *
 * Keep in sync with their definitions:
 * - theme, colorTheme  →  components/theme/ThemeProvider.tsx
 * - ai-studio-language →  i18n/index.ts
 * - ai-studio-sidebar-collapsed / ai-studio-topic-collapsed → components/layout/AppLayout.tsx
 */
const RENDERER_LOCALSTORAGE_KEYS = [
  'theme',
  'colorTheme',
  'ai-studio-language',
  'ai-studio-sidebar-collapsed',
  'ai-studio-topic-collapsed',
] as const

function clearRendererLocalStorage(): void {
  for (const key of RENDERER_LOCALSTORAGE_KEYS) {
    localStorage.removeItem(key)
  }
}

export function DataManagementPanel(): React.JSX.Element {
  const { t } = useTranslation()
  const localizedError = useLocalizedError()
  const exportToFile = useBackupStore((s) => s.exportToFile)
  const importFromFile = useBackupStore((s) => s.importFromFile)

  const [importMode, setImportMode] = useState<BackupImportMode>('replace')
  const [statusMsg, setStatusMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [rollbackOpen, setRollbackOpen] = useState(false)
  const [dangerError, setDangerError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [resetOpen, setResetOpen] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState('')
  const resetBuiltinTemplates = useAssistantTemplateStore((s) => s.resetBuiltins)

  const handleResetBuiltinsOverwrite = async (): Promise<void> => {
    setDangerError(null)
    const ok = await resetBuiltinTemplates('overwrite')
    if (!ok) setDangerError(t('settings.data.builtinTemplates.errors.failed'))
    else setStatusMsg({ kind: 'ok', text: t('settings.data.builtinTemplates.success') })
  }

  const handleResetBuiltinsRestore = async (): Promise<void> => {
    setDangerError(null)
    const ok = await resetBuiltinTemplates('restore-deleted')
    if (!ok) setDangerError(t('settings.data.builtinTemplates.errors.failed'))
    else setStatusMsg({ kind: 'ok', text: t('settings.data.builtinTemplates.success') })
  }

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

  const handleClearChats = async (): Promise<void> => {
    setDangerError(null)
    const result = await window.api.clearChats()
    if (!result.success) {
      setDangerError(result.error ? localizedError(result.error) : 'Failed')
      return
    }
    // No relaunch — reload conversation list and drop the active selection.
    useConversationStore.getState().resetActive()
    await useConversationStore.getState().loadConversations()
    setStatusMsg({ kind: 'ok', text: t('settings.data.clearChats.success') })
  }

  const handleClearSettings = async (): Promise<void> => {
    setDangerError(null)
    clearRendererLocalStorage()
    const result = await window.api.clearSettings()
    if (!result.success) {
      setDangerError(result.error ? localizedError(result.error) : 'Failed')
    }
    // On success: main process relaunches, renderer is torn down.
  }

  const handleReset = async (): Promise<void> => {
    setDangerError(null)
    clearRendererLocalStorage()
    const result = await window.api.resetApp()
    if (!result.success) {
      setDangerError(result.error ? localizedError(result.error) : 'Failed')
    }
    // On success: main process relaunches, renderer is torn down.
  }

  const resetConfirmValid = resetConfirmText.trim().toUpperCase() === 'RESET'

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

      {/* Built-in Templates */}
      <div className="bg-card/50 rounded-xl border">
        <div className="border-b p-5">
          <div className="flex items-center gap-2">
            <LibraryIcon className="h-4 w-4" />
            <h3 className="text-sm font-semibold">{t('settings.data.builtinTemplates.title')}</h3>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            {t('settings.data.builtinTemplates.description')}
          </p>
        </div>
        <DangerRow
          icon={<RotateCcw className="text-foreground mt-0.5 size-4 shrink-0" />}
          title={t('settings.data.builtinTemplates.overwrite.title')}
          description={t('settings.data.builtinTemplates.overwrite.description')}
          trigger={
            <Button variant="outline" size="sm">
              {t('settings.data.builtinTemplates.overwrite.button')}
            </Button>
          }
          dialogTitle={t('settings.data.builtinTemplates.overwrite.confirmTitle')}
          dialogDescription={t('settings.data.builtinTemplates.overwrite.confirm')}
          confirmLabel={t('settings.data.builtinTemplates.overwrite.button')}
          onConfirm={handleResetBuiltinsOverwrite}
        />
        <DangerRow
          icon={<RefreshCw className="text-foreground mt-0.5 size-4 shrink-0" />}
          title={t('settings.data.builtinTemplates.restore.title')}
          description={t('settings.data.builtinTemplates.restore.description')}
          trigger={
            <Button variant="outline" size="sm">
              {t('settings.data.builtinTemplates.restore.button')}
            </Button>
          }
          dialogTitle={t('settings.data.builtinTemplates.restore.confirmTitle')}
          dialogDescription={t('settings.data.builtinTemplates.restore.confirm')}
          confirmLabel={t('settings.data.builtinTemplates.restore.button')}
          onConfirm={handleResetBuiltinsRestore}
        />
      </div>

      {/* Danger zone */}
      <div className="border-destructive/40 bg-destructive/5 divide-y divide-destructive/20 rounded-xl border">
        <div className="p-5">
          <h3 className="text-destructive text-sm font-semibold">
            {t('settings.data.dangerZone.title')}
          </h3>
          <p className="text-muted-foreground mt-1 text-xs">
            {t('settings.data.dangerZone.description')}
          </p>
        </div>

        <DangerRow
          icon={<Trash2 className="text-destructive mt-0.5 size-4 shrink-0" />}
          title={t('settings.data.clearChats.title')}
          description={t('settings.data.clearChats.description')}
          trigger={
            <Button variant="destructive" size="sm">
              {t('settings.data.clearChats.button')}
            </Button>
          }
          dialogTitle={t('settings.data.clearChats.confirmTitle')}
          dialogDescription={t('settings.data.clearChats.confirmDescription')}
          confirmLabel={t('settings.data.clearChats.confirmButton')}
          onConfirm={handleClearChats}
        />

        <DangerRow
          icon={<SettingsIcon className="text-destructive mt-0.5 size-4 shrink-0" />}
          title={t('settings.data.clearSettings.title')}
          description={t('settings.data.clearSettings.description')}
          trigger={
            <Button variant="destructive" size="sm">
              {t('settings.data.clearSettings.button')}
            </Button>
          }
          dialogTitle={t('settings.data.clearSettings.confirmTitle')}
          dialogDescription={t('settings.data.clearSettings.confirmDescription')}
          confirmLabel={t('settings.data.clearSettings.confirmButton')}
          onConfirm={handleClearSettings}
        />

        <div className="flex flex-wrap items-center gap-4 p-5">
          <div className="flex items-start gap-3">
            <RefreshCw className="text-destructive mt-0.5 size-4 shrink-0" />
            <div>
              <Label className="text-sm font-medium">{t('settings.data.resetApp.title')}</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {t('settings.data.resetApp.description')}
              </p>
            </div>
          </div>
          <div className="ml-auto">
            <AlertDialog
              open={resetOpen}
              onOpenChange={(o) => {
                setResetOpen(o)
                if (!o) setResetConfirmText('')
              }}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  {t('settings.data.resetApp.button')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('settings.data.resetApp.confirmTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('settings.data.resetApp.confirmDescription')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2 py-2">
                  <Label className="text-xs">
                    {t('settings.data.resetApp.confirmPromptLabel')}
                  </Label>
                  <Input
                    autoFocus
                    value={resetConfirmText}
                    onChange={(e) => setResetConfirmText(e.target.value)}
                    placeholder="RESET"
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={!resetConfirmValid}
                    onClick={handleReset}
                    variant="destructive">
                    {t('settings.data.resetApp.confirmButton')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {dangerError && (
          <div className="p-4">
            <p className="text-destructive text-xs">{dangerError}</p>
          </div>
        )}
      </div>

      <BackupRollbackDialog open={rollbackOpen} onClose={() => setRollbackOpen(false)} />
    </>
  )
}

function DangerRow({
  icon,
  title,
  description,
  trigger,
  dialogTitle,
  dialogDescription,
  confirmLabel,
  onConfirm,
}: {
  icon: React.ReactNode
  title: string
  description: string
  trigger: React.ReactNode
  dialogTitle: string
  dialogDescription: string
  confirmLabel: string
  onConfirm: () => void | Promise<void>
}): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-center gap-4 p-5">
      <div className="flex items-start gap-3">
        {icon}
        <div>
          <Label className="text-sm font-medium">{title}</Label>
          <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
        </div>
      </div>
      <div className="ml-auto">
        <AlertDialog>
          <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{dialogTitle}</AlertDialogTitle>
              <AlertDialogDescription>{dialogDescription}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={onConfirm} variant="destructive">
                {confirmLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
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
