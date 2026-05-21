import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@renderer/lib/utils'
import type { WebSearchProviderType } from '@shared/types'

interface TabDef {
  id: WebSearchProviderType
  label: string
}

const TABS: TabDef[] = [
  { id: 'tavily', label: 'Tavily' },
  { id: 'brave', label: 'Brave Search' },
  { id: 'searxng', label: 'SearXNG' },
  { id: 'exa', label: 'Exa' },
]

interface WebSearchTabListProps {
  active: WebSearchProviderType
  defaultProvider: WebSearchProviderType
  configuredMap: Record<WebSearchProviderType, boolean>
  onChange: (id: WebSearchProviderType) => void
}

export function WebSearchTabList({
  active,
  defaultProvider,
  configuredMap,
  onChange,
}: WebSearchTabListProps): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <nav className="flex w-48 shrink-0 flex-col border-r p-2">
      <div className="space-y-0.5">
        {TABS.map((tab) => {
          const isActive = active === tab.id
          const isDefault = defaultProvider === tab.id
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
              {isDefault && (
                <span
                  title={t('settings.webSearch.isCurrentDefault')}
                  className="bg-primary/10 text-primary inline-flex h-4 w-4 items-center justify-center rounded-full">
                  <Check className="h-3 w-3" />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
