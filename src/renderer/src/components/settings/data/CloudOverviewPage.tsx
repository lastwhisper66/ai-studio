import { useTranslation } from 'react-i18next'
import { Cloud, Server, ArrowRight } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { useBackupStore } from '@renderer/stores/backupStore'
import { useLocalizedError } from '@renderer/hooks/useLocalizedError'
import { cn } from '@renderer/lib/utils'
import type { RemoteSyncStatus, RemoteType } from '@shared/types'
import type { DataPanelId } from './DataNav'

interface CloudOverviewPageProps {
  onNavigate: (id: DataPanelId) => void
}

/**
 * Top-level summary across both cloud destinations. Each card surfaces the
 * remote's configured/enabled state, last sync info, retention settings, and
 * a "Sync now" / "View detail" pair. Clicking the card title navigates to
 * the per-remote detail page (WebDavPanel / S3Panel).
 */
export function CloudOverviewPage({ onNavigate }: CloudOverviewPageProps): React.JSX.Element {
  const { t } = useTranslation()
  const status = useBackupStore((s) => s.status)
  const syncNow = useBackupStore((s) => s.syncNow)

  const webdav = status?.remotes.webdav ?? null
  const s3 = status?.remotes.s3 ?? null

  return (
    <>
      <div className="bg-card/50 rounded-xl border p-5">
        <h2 className="text-base font-semibold">{t('settings.data.cloudOverview.title')}</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {t('settings.data.cloudOverview.description')}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <RemoteCard
          type="webdav"
          icon={<Cloud className="h-5 w-5" />}
          title={t('settings.data.cloud.webdavTitle')}
          status={webdav}
          onSyncNow={() => syncNow('webdav')}
          onViewDetail={() => onNavigate('webdav')}
        />
        <RemoteCard
          type="s3"
          icon={<Server className="h-5 w-5" />}
          title={t('settings.data.cloud.s3Title')}
          status={s3}
          onSyncNow={() => syncNow('s3')}
          onViewDetail={() => onNavigate('s3')}
        />
      </div>
    </>
  )
}

interface RemoteCardProps {
  type: RemoteType
  icon: React.ReactNode
  title: string
  status: RemoteSyncStatus | null
  onSyncNow: () => Promise<unknown>
  onViewDetail: () => void
}

function RemoteCard({
  icon,
  title,
  status,
  onSyncNow,
  onViewDetail,
}: RemoteCardProps): React.JSX.Element {
  const { t } = useTranslation()
  const localizedError = useLocalizedError()

  const configured = !!status?.configured
  const enabled = !!status?.enabled
  const isSyncing = !!status?.isSyncing

  return (
    <div className="bg-card/50 rounded-xl border p-5">
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-lg">
          {icon}
        </div>
        <h3 className="flex-1 text-sm font-semibold">{title}</h3>
        <StatusBadge configured={configured} enabled={enabled} />
      </div>

      <div className="text-muted-foreground mt-4 flex flex-col gap-1 text-xs">
        {!configured && <span>{t('settings.data.cloudOverview.notConfiguredHint')}</span>}
        {configured && status?.lastSyncedAt && (
          <span>
            {t('settings.backup.lastSynced', {
              at: new Date(status.lastSyncedAt).toLocaleString(),
            })}
          </span>
        )}
        {configured && (
          <span>
            {t('settings.data.cloudOverview.intervalLabel', {
              minutes: status?.autoSyncIntervalMinutes ?? 0,
            })}
          </span>
        )}
        {configured && (
          <span>
            {t('settings.data.cloudOverview.maxRetainedLabel', {
              count: status?.maxRetainedBackups ?? 5,
            })}
          </span>
        )}
        {status?.lastError && (
          <span className="text-destructive">{localizedError(status.lastError)}</span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {configured ? (
          <>
            <Button size="sm" onClick={onSyncNow} disabled={!enabled || isSyncing}>
              {isSyncing ? t('settings.backup.syncing') : t('settings.backup.syncNowButton')}
            </Button>
            <Button size="sm" variant="outline" onClick={onViewDetail}>
              {t('settings.data.cloudOverview.viewDetail')}
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={onViewDetail}>
            {t('settings.data.cloudOverview.configure')}
            <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  )
}

function StatusBadge({
  configured,
  enabled,
}: {
  configured: boolean
  enabled: boolean
}): React.JSX.Element {
  const { t } = useTranslation()
  if (!configured) {
    return (
      <span className="bg-muted text-muted-foreground rounded-md px-2 py-0.5 text-xs">
        {t('settings.data.cloudOverview.badge.notConfigured')}
      </span>
    )
  }
  if (!enabled) {
    return (
      <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600">
        {t('settings.data.cloudOverview.badge.disabled')}
      </span>
    )
  }
  return (
    <span className={cn('rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600')}>
      {t('settings.data.cloudOverview.badge.enabled')}
    </span>
  )
}
