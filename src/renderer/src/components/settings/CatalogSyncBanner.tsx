import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import { Loader2, CheckCircle2, AlertTriangle, Info } from 'lucide-react'
import { useCatalogSyncStore } from '@renderer/stores/catalogSyncStore'

function formatRelativeTime(
  iso: string,
  t: (k: string, opts?: Record<string, unknown>) => string,
): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diffMs / 60_000)
  const hr = Math.floor(min / 60)
  const day = Math.floor(hr / 24)
  if (min < 1) return t('catalog.time.justNow')
  if (min < 60) return t('catalog.time.minutesAgo', { n: min })
  if (hr < 24) return t('catalog.time.hoursAgo', { n: hr })
  return t('catalog.time.daysAgo', { n: day })
}

export function CatalogSyncBanner(): React.JSX.Element | null {
  const { t } = useTranslation()
  const status = useCatalogSyncStore((s) => s.status)
  const syncNow = useCatalogSyncStore((s) => s.syncNow)
  const init = useCatalogSyncStore((s) => s.init)

  useEffect(() => {
    void init()
  }, [init])

  const inFlight = status.isInFlight
  const hasOk = status.lastSyncStatus === 'ok' && status.lastSyncAt
  const hasError = status.lastSyncStatus === 'error'
  const neverSynced = !status.lastSyncAt && !hasError && !inFlight

  if (inFlight) {
    return (
      <div className="flex items-center gap-2 border-b px-3 py-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
        <span>{t('catalog.banner.syncing')}</span>
      </div>
    )
  }
  if (hasError) {
    return (
      <div className="bg-destructive/5 flex items-center gap-2 border-b px-3 py-2 text-sm">
        <AlertTriangle className="text-destructive h-4 w-4" />
        <span className="flex-1">
          {t('catalog.banner.errorPrefix')}
          {t(`catalog.error.${status.lastSyncError ?? 'unknown'}`, {
            defaultValue: status.lastSyncError ?? '',
          })}
        </span>
        <Button size="sm" variant="outline" onClick={() => void syncNow()}>
          {t('catalog.banner.retry')}
        </Button>
      </div>
    )
  }
  if (neverSynced) {
    return (
      <div className="bg-muted/30 flex items-center gap-2 border-b px-3 py-2 text-sm">
        <Info className="text-muted-foreground h-4 w-4" />
        <span className="flex-1">{t('catalog.banner.neverSynced')}</span>
        <Button size="sm" onClick={() => void syncNow()}>
          {t('catalog.banner.syncNow')}
        </Button>
      </div>
    )
  }
  if (hasOk) {
    return (
      <div className="flex items-center gap-2 border-b px-3 py-2 text-sm">
        <CheckCircle2 className="h-4 w-4 text-green-500" />
        <span className="flex-1">
          {t('catalog.banner.okPrefix')}
          {formatRelativeTime(status.lastSyncAt!, t)}
        </span>
        <Button size="sm" variant="outline" onClick={() => void syncNow()}>
          {t('catalog.banner.syncNow')}
        </Button>
      </div>
    )
  }
  return null
}
