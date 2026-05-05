import { useState } from 'react'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { DataNav, type DataPanelId } from './DataNav'
import { DataManagementPanel } from './DataManagementPanel'
import { CloudOverviewPage } from './CloudOverviewPage'
import { WebDavPanel } from './WebDavPanel'
import { S3Panel } from './S3Panel'

/**
 * Top-level "Data Settings" page. Two-column inside: a secondary nav with two
 * groups (Local Data / Cloud Backup) plus the panel for the current entry.
 *
 * The cloud destinations are now fully independent — `cloud-overview` is a
 * summary across both, while `webdav` and `s3` each render a complete detail
 * page (status + credentials + per-remote sync options).
 */
export function DataSection(): React.JSX.Element {
  const [active, setActive] = useState<DataPanelId>('data-management')

  return (
    <div className="flex h-full min-w-0 flex-1">
      <DataNav active={active} onSelect={setActive} />
      <ScrollArea className="flex-1">
        <div className="space-y-5 p-6">
          {active === 'data-management' && <DataManagementPanel />}
          {active === 'cloud-overview' && <CloudOverviewPage onNavigate={setActive} />}
          {active === 'webdav' && <WebDavPanel />}
          {active === 's3' && <S3Panel />}
        </div>
      </ScrollArea>
    </div>
  )
}
