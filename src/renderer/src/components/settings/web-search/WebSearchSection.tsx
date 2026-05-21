import { useTranslation } from 'react-i18next'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import type { WebSearchProviderType } from '@shared/types'
import { WebSearchTabList } from './WebSearchTabList'
import { WebSearchHeader } from './WebSearchHeader'
import { WebSearchCommonParams } from './WebSearchCommonParams'
import { TavilyForm } from './providers/TavilyForm'
import { BraveForm } from './providers/BraveForm'
import { ExaForm } from './providers/ExaForm'
import { SearxngForm } from './providers/SearxngForm'

const VALID_PROVIDERS: WebSearchProviderType[] = ['tavily', 'brave', 'searxng', 'exa']

function normalizeProvider(raw: string | undefined): WebSearchProviderType {
  if (raw && (VALID_PROVIDERS as string[]).includes(raw)) {
    return raw as WebSearchProviderType
  }
  return 'tavily'
}

export function WebSearchSection(): React.JSX.Element {
  const { t } = useTranslation()
  const settings = useSettingsStore((s) => s.settings)
  const saveSettings = useSettingsStore((s) => s.saveSettings)

  const activeTab = normalizeProvider(settings['webSearch.provider'])
  const defaultProvider = normalizeProvider(
    settings['webSearch.defaultProvider'] ?? settings['webSearch.provider'],
  )

  const configuredMap: Record<WebSearchProviderType, boolean> = {
    tavily: (settings['webSearch.tavilyApiKey'] ?? '').length > 0,
    brave: (settings['webSearch.braveApiKey'] ?? '').length > 0,
    searxng: (settings['webSearch.searxngUrl'] ?? '').length > 0,
    exa: (settings['webSearch.exaApiKey'] ?? '').length > 0,
  }

  const setActiveTab = (id: WebSearchProviderType): void => {
    void saveSettings({ 'webSearch.provider': id })
  }

  return (
    <div className="flex h-full flex-1 min-w-0">
      <WebSearchTabList
        active={activeTab}
        defaultProvider={defaultProvider}
        configuredMap={configuredMap}
        onChange={setActiveTab}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <WebSearchHeader
          activeTab={activeTab}
          defaultProvider={defaultProvider}
          configuredMap={configuredMap}
        />
        <ScrollArea className="flex-1">
          <div className="max-w-2xl space-y-6 p-6">
            <header>
              <h2 className="text-lg font-semibold">{t('settings.webSearch.title')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('settings.webSearch.description')}
              </p>
            </header>
            <WebSearchCommonParams />
            <div className="border-t pt-6">
              {activeTab === 'tavily' && <TavilyForm />}
              {activeTab === 'brave' && <BraveForm />}
              {activeTab === 'searxng' && <SearxngForm />}
              {activeTab === 'exa' && <ExaForm />}
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
