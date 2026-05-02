import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, ExternalLink, RotateCw, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import type { UpdaterState } from '@shared/types'

const IDLE_STATE: UpdaterState = {
  status: 'idle',
  currentVersion: '',
  isMacFallback: false,
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let n = bytes
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function UpdateDialog(): React.JSX.Element | null {
  const { t } = useTranslation()
  const [state, setState] = useState<UpdaterState>(IDLE_STATE)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    let cancelled = false
    window.api.getUpdaterState().then((result) => {
      if (!cancelled && result.success && result.data) setState(result.data)
    })
    const unsub = window.api.onUpdaterStateChanged((next) => {
      setState(next)
      // Re-show the dialog whenever a new meaningful state comes in
      // (e.g. startup check finishes and reports "available").
      setDismissed(false)
    })
    return () => {
      cancelled = true
      unsub()
    }
  }, [])

  // Decide whether the dialog should be visible for the current state.
  const shouldShow = ((): boolean => {
    if (dismissed) return false
    switch (state.status) {
      case 'idle':
        return false
      case 'checking':
        return state.manualCheck === true
      case 'not-available':
        return state.manualCheck === true
      case 'available':
      case 'downloading':
      case 'downloaded':
      case 'error':
        return true
      default:
        return false
    }
  })()

  if (!shouldShow) return null

  const handleDismiss = (): void => setDismissed(true)

  const renderBody = (): React.JSX.Element => {
    switch (state.status) {
      case 'checking':
        return (
          <div className="flex items-center gap-3 py-6">
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
            <span className="text-sm">{t('updater.checking')}</span>
          </div>
        )

      case 'not-available':
        return (
          <div className="flex items-start gap-3 py-4">
            <CheckCircle2 className="mt-0.5 size-5 text-green-500" />
            <p className="text-sm">
              {t('updater.upToDateDescription', { version: state.currentVersion })}
            </p>
          </div>
        )

      case 'available':
        return (
          <div className="space-y-3 py-2">
            <p className="text-sm">
              {t('updater.availableDescription', {
                name: 'AI Studio',
                version: state.latestVersion ?? '',
                current: state.currentVersion,
              })}
            </p>
            {state.releaseNotes && (
              <div className="space-y-1.5">
                <p className="text-muted-foreground text-xs font-medium">
                  {t('updater.releaseNotes')}
                </p>
                <div className="release-notes max-h-48 overflow-y-auto rounded-md border bg-muted/30 p-3 text-xs">
                  <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>
                    {state.releaseNotes}
                  </Markdown>
                </div>
              </div>
            )}
          </div>
        )

      case 'downloading': {
        const percent = state.downloadProgress?.percent ?? 0
        const transferred = state.downloadProgress?.transferred ?? 0
        const total = state.downloadProgress?.total ?? 0
        return (
          <div className="space-y-3 py-2">
            <p className="text-sm">{t('updater.downloading')}</p>
            <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
              <div
                className="bg-primary h-full transition-all"
                style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              {t('updater.downloadProgress', {
                percent: percent.toFixed(1),
                transferred: formatBytes(transferred),
                total: formatBytes(total),
              })}
            </p>
          </div>
        )
      }

      case 'downloaded':
        return (
          <div className="flex items-start gap-3 py-4">
            <CheckCircle2 className="mt-0.5 size-5 text-green-500" />
            <p className="text-sm">{t('updater.downloadedDescription')}</p>
          </div>
        )

      case 'error':
        return (
          <div className="flex items-start gap-3 py-4">
            <AlertCircle className="mt-0.5 size-5 text-destructive" />
            <p className="text-sm break-all">{state.error ?? ''}</p>
          </div>
        )

      default:
        return <div />
    }
  }

  const renderFooter = (): React.JSX.Element => {
    switch (state.status) {
      case 'available':
        return (
          <>
            <Button variant="outline" onClick={handleDismiss}>
              {t('updater.remindLater')}
            </Button>
            {state.isMacFallback ? (
              <Button onClick={() => window.api.openReleasePage()}>
                <ExternalLink className="size-4" />
                {t('updater.openDownloadPage')}
              </Button>
            ) : (
              <Button onClick={() => window.api.downloadUpdate()}>
                <Download className="size-4" />
                {t('updater.downloadNow')}
              </Button>
            )}
          </>
        )

      case 'downloading':
        return (
          <Button variant="outline" onClick={handleDismiss}>
            {t('updater.remindLater')}
          </Button>
        )

      case 'downloaded':
        return (
          <>
            <Button variant="outline" onClick={handleDismiss}>
              {t('updater.installLater')}
            </Button>
            <Button onClick={() => window.api.quitAndInstallUpdate()}>
              {t('updater.installNow')}
            </Button>
          </>
        )

      case 'error':
        return (
          <>
            <Button variant="outline" onClick={handleDismiss}>
              {t('common.close')}
            </Button>
            <Button onClick={() => window.api.checkForUpdates()}>
              <RotateCw className="size-4" />
              {t('updater.retry')}
            </Button>
          </>
        )

      case 'checking':
      case 'not-available':
        return (
          <Button variant="outline" onClick={handleDismiss}>
            {t('common.close')}
          </Button>
        )

      default:
        return <div />
    }
  }

  const titleKey = ((): string => {
    switch (state.status) {
      case 'checking':
        return 'updater.checking'
      case 'not-available':
        return 'updater.upToDate'
      case 'available':
        return 'updater.available'
      case 'downloading':
        return 'updater.downloading'
      case 'downloaded':
        return 'updater.downloaded'
      case 'error':
        return 'updater.errorTitle'
      default:
        return 'updater.title'
    }
  })()

  return (
    <Dialog
      open={shouldShow}
      onOpenChange={(open) => {
        if (!open) handleDismiss()
      }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t(titleKey)}</DialogTitle>
          <DialogDescription className="sr-only">{t('updater.title')}</DialogDescription>
        </DialogHeader>
        {renderBody()}
        <DialogFooter>{renderFooter()}</DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
