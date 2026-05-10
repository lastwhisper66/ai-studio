import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RotateCcw, RefreshCw } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { Button } from '@renderer/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@renderer/components/ui/alert-dialog'
import { useAssistantTemplateStore } from '@renderer/stores/assistantTemplateStore'

interface CategoryCount {
  id: string
  count: number
}

interface CategorySidebarProps {
  categories: CategoryCount[]
  totalCount: number
  activeCategory: string | null
  onSelect: (category: string | null) => void
}

type ResultDialog = { kind: 'ok' | 'err'; text: string } | null

export function CategorySidebar({
  categories,
  totalCount,
  activeCategory,
  onSelect,
}: CategorySidebarProps): React.JSX.Element {
  const { t } = useTranslation()
  const resetBuiltins = useAssistantTemplateStore((s) => s.resetBuiltins)
  const [overwriteOpen, setOverwriteOpen] = useState(false)
  const [restoreOpen, setRestoreOpen] = useState(false)
  const [result, setResult] = useState<ResultDialog>(null)

  const handleOverwrite = async (): Promise<void> => {
    const ok = await resetBuiltins('overwrite')
    setOverwriteOpen(false)
    setResult({
      kind: ok ? 'ok' : 'err',
      text: ok
        ? t('settings.data.builtinTemplates.success')
        : t('settings.data.builtinTemplates.errors.failed'),
    })
  }

  const handleRestore = async (): Promise<void> => {
    const ok = await resetBuiltins('restore-deleted')
    setRestoreOpen(false)
    setResult({
      kind: ok ? 'ok' : 'err',
      text: ok
        ? t('settings.data.builtinTemplates.success')
        : t('settings.data.builtinTemplates.errors.failed'),
    })
  }

  const renderEntry = (id: string | null, label: string, count: number): React.JSX.Element => (
    <button
      key={id ?? '__all__'}
      onClick={() => onSelect(id)}
      className={cn(
        'flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
        activeCategory === id
          ? 'bg-accent text-accent-foreground font-medium'
          : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground',
      )}>
      <span className="truncate">{label}</span>
      <span className="ml-2 shrink-0 rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
        {count}
      </span>
    </button>
  )

  return (
    <aside className="flex h-full w-[130px] shrink-0 flex-col border-r p-2">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {renderEntry(null, t('library.categories.all'), totalCount)}
        <div className="mt-2 space-y-0.5">
          {categories.map((c) =>
            renderEntry(c.id, t(`library.categories.${c.id}`, { defaultValue: c.id }), c.count),
          )}
        </div>
      </div>

      <div className="mt-2 shrink-0 space-y-1 border-t pt-2">
        <p className="px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
          {t('library.sidebar.builtinTemplates')}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-full justify-start gap-1.5 px-2 text-[11px] text-muted-foreground hover:text-foreground"
          onClick={() => setOverwriteOpen(true)}>
          <RotateCcw className="h-3 w-3" />
          {t('library.sidebar.overwrite')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-full justify-start gap-1.5 px-2 text-[11px] text-muted-foreground hover:text-foreground"
          onClick={() => setRestoreOpen(true)}>
          <RefreshCw className="h-3 w-3" />
          {t('library.sidebar.restore')}
        </Button>
      </div>

      <AlertDialog open={overwriteOpen} onOpenChange={setOverwriteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('settings.data.builtinTemplates.overwrite.confirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.data.builtinTemplates.overwrite.confirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleOverwrite}>
              {t('settings.data.builtinTemplates.overwrite.button')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={restoreOpen} onOpenChange={setRestoreOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('settings.data.builtinTemplates.restore.confirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.data.builtinTemplates.restore.confirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore}>
              {t('settings.data.builtinTemplates.restore.button')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={result !== null} onOpenChange={(o) => !o && setResult(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {result?.kind === 'ok'
                ? t('library.sidebar.resultSuccess')
                : t('library.sidebar.resultFailed')}
            </AlertDialogTitle>
            <AlertDialogDescription>{result?.text}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setResult(null)}>
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  )
}
