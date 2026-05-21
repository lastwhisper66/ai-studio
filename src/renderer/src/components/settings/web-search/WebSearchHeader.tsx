import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import { Label } from '@renderer/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import type { WebSearchProviderType } from '@shared/types'

const OPTIONS: { id: WebSearchProviderType; label: string }[] = [
  { id: 'tavily', label: 'Tavily' },
  { id: 'brave', label: 'Brave Search' },
  { id: 'searxng', label: 'SearXNG' },
  { id: 'exa', label: 'Exa' },
]

interface WebSearchHeaderProps {
  activeTab: WebSearchProviderType
  defaultProvider: WebSearchProviderType
  configuredMap: Record<WebSearchProviderType, boolean>
}

export function WebSearchHeader({
  activeTab,
  defaultProvider,
  configuredMap,
}: WebSearchHeaderProps): React.JSX.Element {
  const { t } = useTranslation()
  const saveSettings = useSettingsStore((s) => s.saveSettings)

  const setDefault = (id: WebSearchProviderType): void => {
    void saveSettings({ 'webSearch.defaultProvider': id })
  }

  const isActiveTabConfigured = configuredMap[activeTab]
  const activeTabIsDefault = activeTab === defaultProvider

  return (
    <div className="border-b px-6 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Label className="text-sm shrink-0">{t('settings.webSearch.defaultProvider')}</Label>
          <Select
            value={defaultProvider}
            onValueChange={(v) => setDefault(v as WebSearchProviderType)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPTIONS.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  <span className="flex items-center gap-2">
                    <span
                      className={
                        configuredMap[o.id]
                          ? 'h-1.5 w-1.5 rounded-full bg-emerald-500'
                          : 'h-1.5 w-1.5 rounded-full bg-muted-foreground/40'
                      }
                    />
                    {o.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!configuredMap[defaultProvider] && (
            <span className="text-xs text-destructive">
              {t('settings.webSearch.notConfiguredHint')}
            </span>
          )}
        </div>
        {activeTabIsDefault ? (
          <span className="text-primary bg-primary/10 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs">
            <Check className="h-3 w-3" />
            {t('settings.webSearch.isCurrentDefault')}
          </span>
        ) : isActiveTabConfigured ? (
          <Button variant="outline" size="sm" onClick={() => setDefault(activeTab)}>
            {t('settings.webSearch.setAsDefault')}
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0}>
                <Button variant="outline" size="sm" disabled>
                  {t('settings.webSearch.setAsDefault')}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{t('settings.webSearch.notConfiguredHint')}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  )
}
