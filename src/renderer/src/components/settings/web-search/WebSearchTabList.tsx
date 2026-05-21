import { Settings2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@renderer/lib/utils'
import type { WebSearchProviderType } from '@shared/types'

export type WebSearchTabId = 'common' | WebSearchProviderType

interface ProviderTabDef {
  id: WebSearchProviderType
  label: string
}

const PROVIDER_TABS: ProviderTabDef[] = [
  { id: 'tavily', label: 'Tavily' },
  { id: 'brave', label: 'Brave Search' },
  { id: 'searxng', label: 'SearXNG' },
  { id: 'exa', label: 'Exa' },
]

interface WebSearchTabListProps {
  active: WebSearchTabId
  configuredMap: Record<WebSearchProviderType, boolean>
  onChange: (id: WebSearchTabId) => void
}

export function WebSearchTabList({
  active,
  configuredMap,
  onChange,
}: WebSearchTabListProps): React.JSX.Element {
  const { t } = useTranslation()
  const isCommonActive = active === 'common'

  return (
    <nav className="flex w-56 shrink-0 flex-col border-r p-2">
      <div className="space-y-0.5">
        <button
          type="button"
          onClick={() => onChange('common')}
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
            isCommonActive
              ? 'bg-accent text-accent-foreground font-medium'
              : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
          )}>
          <Settings2 className="h-3.5 w-3.5" />
          <span className="min-w-0 flex-1 truncate">{t('settings.webSearch.commonParams')}</span>
        </button>

        <div className="px-2 pt-3 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground/70 uppercase">
          {t('settings.webSearch.provider')}
        </div>

        {PROVIDER_TABS.map((tab) => {
          const isActive = active === tab.id
          const isConfigured = configuredMap[tab.id]

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                isActive
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              )}>
              <span
                aria-label={
                  isConfigured
                    ? t('settings.webSearch.configured')
                    : t('settings.webSearch.notConfigured')
                }
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  isConfigured ? 'bg-emerald-500' : 'bg-muted-foreground/40',
                )}
              />
              <span className="min-w-0 flex-1 truncate">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
