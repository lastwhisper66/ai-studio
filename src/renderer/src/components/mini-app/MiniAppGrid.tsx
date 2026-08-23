import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Settings2 } from 'lucide-react'
import type { MiniApp } from '@shared/types'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { MiniAppIcon } from './MiniAppIcon'

interface MiniAppGridProps {
  apps: MiniApp[]
  onOpen: (appId: string) => void
}

export function MiniAppGrid({ apps, onOpen }: MiniAppGridProps): React.JSX.Element {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const navigateToSettings = useSettingsStore((s) => s.navigateToSettings)

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return apps
      .filter((a) => a.enabled)
      .filter((a) => !needle || a.name.toLowerCase().includes(needle))
  }, [apps, search])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('miniApps.searchPlaceholder')}
            className="h-8 pl-8 text-sm"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {t('miniApps.count', { count: visible.length })}
        </span>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => navigateToSettings('mini-apps')}>
          <Settings2 className="mr-1.5 h-3.5 w-3.5" />
          {t('miniApps.manage')}
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {visible.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            {search ? t('miniApps.empty.noResults') : t('miniApps.empty.noApps')}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {visible.map((app) => (
              <button
                key={app.id}
                onClick={() => onOpen(app.id)}
                title={app.url}
                className="flex flex-col items-center gap-2.5 rounded-xl border bg-card/50 p-4 transition-colors hover:border-primary/40 hover:bg-accent/50">
                <MiniAppIcon app={app} size="lg" />
                <span className="w-full truncate text-center text-sm font-medium">{app.name}</span>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
