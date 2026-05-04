import { Database, HardDriveDownload, Cloud, Server } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@renderer/lib/utils'
import { Separator } from '@renderer/components/ui/separator'

export type DataPanelId = 'local-data' | 'local-backup' | 'webdav' | 's3'

interface DataNavProps {
  active: DataPanelId
  onSelect: (id: DataPanelId) => void
}

interface NavItem {
  id: DataPanelId
  labelKey: string
  icon: React.ElementType
}

interface NavGroup {
  labelKey: string
  items: NavItem[]
}

const groups: NavGroup[] = [
  {
    labelKey: 'settings.data.nav.localGroup',
    items: [{ id: 'local-data', labelKey: 'settings.data.nav.localData', icon: Database }],
  },
  {
    labelKey: 'settings.data.nav.localBackupGroup',
    items: [
      { id: 'local-backup', labelKey: 'settings.data.nav.localBackup', icon: HardDriveDownload },
    ],
  },
  {
    labelKey: 'settings.data.nav.cloudGroup',
    items: [
      { id: 'webdav', labelKey: 'settings.data.nav.webdav', icon: Cloud },
      { id: 's3', labelKey: 'settings.data.nav.s3', icon: Server },
    ],
  },
]

export function DataNav({ active, onSelect }: DataNavProps): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <nav className="flex h-full w-56 shrink-0 flex-col border-r p-3">
      {groups.map((group, groupIndex) => (
        <div key={group.labelKey}>
          {groupIndex > 0 && <Separator className="my-3" />}
          <div className="text-muted-foreground mb-2 px-2 text-xs font-medium">
            {t(group.labelKey)}
          </div>
          <div className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  onClick={() => onSelect(item.id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors',
                    active === item.id
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                      : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
                  )}>
                  <Icon className="h-4 w-4" />
                  {t(item.labelKey)}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}
