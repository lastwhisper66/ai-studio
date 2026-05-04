import { useState } from 'react'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { DataNav, type DataPanelId } from './DataNav'
import { LocalDataPanel } from './LocalDataPanel'
import { LocalBackupPanel } from './LocalBackupPanel'
import { WebDavPanel } from './WebDavPanel'
import { S3Panel } from './S3Panel'
import { CloudOverview } from './CloudOverview'

/**
 * Top-level "Data Settings" page. Two-column inside: a secondary nav (groups
 * "Local Data Settings" / "Local Backup" / "Cloud Backup") plus the panel
 * for the currently-selected entry on the right.
 *
 * The cloud panels (WebDAV / S3) share a common overview header that shows
 * sync status + global controls (auto-sync interval, max retained backups,
 * sync now, history) — those settings are global to the cloud-sync engine
 * regardless of which remote is highlighted.
 */
export function DataSection(): React.JSX.Element {
  const [active, setActive] = useState<DataPanelId>('local-data')

  return (
    <div className="flex h-full min-w-0 flex-1">
      <DataNav active={active} onSelect={setActive} />
      <ScrollArea className="flex-1">
        <div className="space-y-5 p-6">
          {active === 'local-data' && <LocalDataPanel />}
          {active === 'local-backup' && <LocalBackupPanel />}
          {(active === 'webdav' || active === 's3') && <CloudOverview />}
          {active === 'webdav' && <WebDavPanel />}
          {active === 's3' && <S3Panel />}
        </div>
      </ScrollArea>
    </div>
  )
}
