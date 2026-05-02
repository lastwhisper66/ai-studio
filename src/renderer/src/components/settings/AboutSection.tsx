import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Database,
  ExternalLink,
  Github,
  History,
  Loader2,
  MessageSquare,
  RefreshCw,
  Sparkles,
  TextSelect,
  Zap,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { cn } from '@renderer/lib/utils'
import type { AppReleaseInfo, UpdaterState, UpdaterStatus } from '@shared/types'

const IDLE_STATE: UpdaterState = {
  status: 'idle',
  currentVersion: '',
  isMacFallback: false,
}

const statusTone: Record<UpdaterStatus, string> = {
  idle: 'bg-muted text-muted-foreground',
  checking: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  available: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  'not-available': 'bg-green-500/10 text-green-700 dark:text-green-400',
  downloading: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  downloaded: 'bg-green-500/10 text-green-700 dark:text-green-400',
  error: 'bg-destructive/10 text-destructive',
}

const features = [
  { key: 'chat', icon: MessageSquare },
  { key: 'quickAssistant', icon: Zap },
  { key: 'selectionAssistant', icon: TextSelect },
  { key: 'localData', icon: Database },
]

function formatReleaseDate(value: string | undefined, locale: string | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(locale || undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export function AboutSection(): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const [updaterState, setUpdaterState] = useState<UpdaterState>(IDLE_STATE)
  const [checking, setChecking] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [changelogOpen, setChangelogOpen] = useState(false)
  const [release, setRelease] = useState<AppReleaseInfo | null>(null)
  const [releaseLoading, setReleaseLoading] = useState(false)
  const [releaseError, setReleaseError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    window.api.getUpdaterState().then((result) => {
      if (!cancelled && result.success && result.data) {
        setUpdaterState(result.data)
        setChecking(result.data.status === 'checking')
      }
    })
    const unsub = window.api.onUpdaterStateChanged((state) => {
      setUpdaterState(state)
      setChecking(state.status === 'checking')
    })
    return () => {
      cancelled = true
      unsub()
    }
  }, [])

  const loadLatestRelease = useCallback(async (): Promise<void> => {
    setReleaseLoading(true)
    setReleaseError(null)
    const result = await window.api.getLatestRelease()
    if (result.success && result.data) {
      setRelease(result.data)
    } else {
      setReleaseError(
        result.error
          ? t(result.error.code, result.error.params ?? {})
          : t('settings.about.changelogLoadFailed'),
      )
    }
    setReleaseLoading(false)
  }, [t])

  const status = updaterState.status
  const isChecking = checking || status === 'checking'
  const releaseDate = useMemo(
    () => formatReleaseDate(release?.publishedAt, i18n.resolvedLanguage),
    [i18n.resolvedLanguage, release?.publishedAt],
  )

  const handleCheckForUpdates = async (): Promise<void> => {
    setActionError(null)
    setChecking(true)
    const result = await window.api.checkForUpdates()
    if (!result.success) {
      setChecking(false)
      setActionError(
        result.error
          ? t(result.error.code, result.error.params ?? {})
          : t('settings.about.checkFailed'),
      )
    }
  }

  const handleOpenChangelog = (): void => {
    setChangelogOpen(true)
    if (!release && !releaseLoading) {
      void loadLatestRelease()
    }
  }

  const handleOpenProject = async (): Promise<void> => {
    setActionError(null)
    const result = await window.api.openProjectPage()
    if (!result.success) {
      setActionError(
        result.error
          ? t(result.error.code, result.error.params ?? {})
          : t('settings.about.projectOpenFailed'),
      )
    }
  }

  const handleOpenReleases = async (): Promise<void> => {
    const result = await window.api.openReleasesPage()
    if (!result.success) {
      setReleaseError(
        result.error
          ? t(result.error.code, result.error.params ?? {})
          : t('settings.about.releasesOpenFailed'),
      )
    }
  }

  return (
    <>
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="rounded-xl border bg-card/50 p-5">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="flex min-w-0 gap-4">
              <div className="bg-primary text-primary-foreground flex size-14 shrink-0 items-center justify-center rounded-xl shadow-sm">
                <Sparkles className="size-7" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold tracking-normal">AI Studio</h2>
                  <span className="bg-muted text-muted-foreground rounded-md px-2 py-1 text-xs font-medium">
                    {t('settings.about.version', {
                      version: updaterState.currentVersion || '-',
                    })}
                  </span>
                </div>
                <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
                  {t('settings.about.description')}
                </p>
                <p className="text-muted-foreground mt-1 max-w-2xl text-xs leading-5">
                  {t('settings.about.tagline')}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium',
                  statusTone[status],
                )}>
                {isChecking ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : status === 'error' ? (
                  <AlertCircle className="size-3.5" />
                ) : (
                  <CheckCircle2 className="size-3.5" />
                )}
                {t(`settings.about.status.${status}`)}
              </span>
              <span className="text-muted-foreground text-xs">
                {t('settings.about.currentVersion', {
                  version: updaterState.currentVersion || '-',
                })}
              </span>
            </div>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold">{t('settings.about.featureTitle')}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {features.map(({ key, icon: Icon }) => (
              <div key={key} className="rounded-xl border bg-card/50 p-4">
                <div className="flex items-start gap-3">
                  <div className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-medium">
                      {t(`settings.about.features.${key}.title`)}
                    </h4>
                    <p className="text-muted-foreground mt-1 text-xs leading-5">
                      {t(`settings.about.features.${key}.description`)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-card/50 p-5">
          <h3 className="text-sm font-semibold">{t('settings.about.actionsTitle')}</h3>
          <div className="mt-4 divide-y">
            <div className="flex flex-col gap-3 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <RefreshCw className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t('settings.about.checkUpdates')}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs leading-5">
                    {t('settings.about.checkUpdatesDescription')}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full sm:w-auto"
                disabled={isChecking}
                onClick={handleCheckForUpdates}>
                <RefreshCw className={cn('size-4', isChecking && 'animate-spin')} />
                {isChecking ? t('settings.about.checking') : t('settings.about.checkUpdates')}
              </Button>
            </div>

            <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <Github className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t('settings.about.openGitHub')}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs leading-5">
                    {t('settings.about.openGitHubDescription')}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={handleOpenProject}>
                <ExternalLink className="size-4" />
                GitHub
              </Button>
            </div>

            <div className="flex flex-col gap-3 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <History className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t('settings.about.viewChangelog')}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs leading-5">
                    {t('settings.about.viewChangelogDescription')}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={handleOpenChangelog}>
                <History className="size-4" />
                {t('settings.about.viewChangelog')}
              </Button>
            </div>
          </div>
          {actionError && <p className="mt-3 text-xs text-destructive">{actionError}</p>}
        </div>
      </div>

      <Dialog open={changelogOpen} onOpenChange={setChangelogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('settings.about.changelogTitle')}</DialogTitle>
            <DialogDescription>{t('settings.about.changelogDescription')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {release && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">
                  {t('settings.about.latestRelease', { version: release.version })}
                </span>
                {releaseDate && (
                  <span className="text-muted-foreground text-xs">
                    {t('settings.about.publishedAt', { date: releaseDate })}
                  </span>
                )}
              </div>
            )}

            <ScrollArea className="max-h-[52vh] rounded-md border bg-muted/20">
              <div className="release-notes min-h-28 p-4 text-sm">
                {releaseLoading ? (
                  <div className="text-muted-foreground flex items-center gap-2 py-8">
                    <Loader2 className="size-4 animate-spin" />
                    {t('settings.about.loadingChangelog')}
                  </div>
                ) : releaseError ? (
                  <div className="text-destructive flex items-center gap-2 py-8">
                    <AlertCircle className="size-4" />
                    {releaseError}
                  </div>
                ) : release?.notes ? (
                  <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>
                    {release.notes}
                  </Markdown>
                ) : (
                  <p className="text-muted-foreground">{t('settings.about.changelogEmpty')}</p>
                )}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setChangelogOpen(false)}>
              {t('common.close')}
            </Button>
            <Button onClick={handleOpenReleases}>
              <ExternalLink className="size-4" />
              {t('settings.about.openAllReleases')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
