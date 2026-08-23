import { useTranslation } from 'react-i18next'
import { X, LayoutGrid } from 'lucide-react'
import type { MiniApp } from '@shared/types'
import { cn } from '@renderer/lib/utils'
import { Button } from '@renderer/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import type { MiniAppTab } from '@renderer/stores/miniAppStore'
import { MiniAppIcon } from './MiniAppIcon'

interface MiniAppTabBarProps {
  tabs: MiniAppTab[]
  apps: MiniApp[]
  /** null means the app grid is showing rather than a tab. */
  activeTabId: string | null
  onSelect: (appId: string) => void
  onClose: (appId: string) => void
  onShowGrid: () => void
}

export function MiniAppTabBar({
  tabs,
  apps,
  activeTabId,
  onSelect,
  onClose,
  onShowGrid,
}: MiniAppTabBarProps): React.JSX.Element {
  const { t } = useTranslation()
  const appById = new Map(apps.map((a) => [a.id, a]))

  return (
    <div className="flex h-10 shrink-0 items-center gap-1 border-b px-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-7 w-7 shrink-0', activeTabId === null && 'text-nav-active')}
            aria-label={t('miniApps.showAll')}
            onClick={onShowGrid}>
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t('miniApps.showAll')}</TooltipContent>
      </Tooltip>

      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const app = appById.get(tab.appId)
          const active = tab.appId === activeTabId
          return (
            <div
              key={tab.appId}
              role="tab"
              aria-selected={active}
              tabIndex={0}
              title={tab.title}
              onClick={() => onSelect(tab.appId)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(tab.appId)
                }
              }}
              onAuxClick={(e) => {
                // Middle-click closes, matching browser convention.
                if (e.button === 1) {
                  e.preventDefault()
                  onClose(tab.appId)
                }
              }}
              className={cn(
                'group flex h-7 max-w-44 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs transition-colors',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                  : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
              )}>
              {app && <MiniAppIcon app={app} size="xs" />}
              <span className="min-w-0 flex-1 truncate">{tab.title}</span>
              <button
                aria-label={t('miniApps.closeTab')}
                onClick={(e) => {
                  e.stopPropagation()
                  onClose(tab.appId)
                }}
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted focus-visible:opacity-100">
                <X className="h-3 w-3" />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
