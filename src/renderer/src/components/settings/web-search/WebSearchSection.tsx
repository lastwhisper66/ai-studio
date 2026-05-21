import { useTranslation } from 'react-i18next'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import type { WebSearchProviderType } from '@shared/types'
import { WebSearchTabList, type WebSearchTabId } from './WebSearchTabList'
import { WebSearchCommonParams } from './WebSearchCommonParams'
import { TavilyForm } from './providers/TavilyForm'
import { BraveForm } from './providers/BraveForm'
import { ExaForm } from './providers/ExaForm'
import { SearxngForm } from './providers/SearxngForm'

const VALID_PROVIDERS: WebSearchProviderType[] = ['tavily', 'brave', 'searxng', 'exa']

function isValidProvider(raw: string | undefined): raw is WebSearchProviderType {
  return !!raw && (VALID_PROVIDERS as string[]).includes(raw)
}

function normalizeActiveTab(raw: string | undefined): WebSearchTabId {
  if (raw === 'common') return 'common'
  return isValidProvider(raw) ? raw : 'common'
}

export function WebSearchSection(): React.JSX.Element {
  const { t } = useTranslation()
  const settings = useSettingsStore((s) => s.settings)
  const saveSettings = useSettingsStore((s) => s.saveSettings)

  const activeTab = normalizeActiveTab(settings['webSearch.provider'])

  const configuredMap: Record<WebSearchProviderType, boolean> = {
    tavily: (settings['webSearch.tavilyApiKey'] ?? '').length > 0,
    brave: (settings['webSearch.braveApiKey'] ?? '').length > 0,
    searxng: (settings['webSearch.searxngUrl'] ?? '').length > 0,
    exa: (settings['webSearch.exaApiKey'] ?? '').length > 0,
  }

  const setActiveTab = (id: WebSearchTabId): void => {
    void saveSettings({ 'webSearch.provider': id })
  }

  return (
    <div className="flex h-full flex-1 min-w-0">
      <WebSearchTabList active={activeTab} configuredMap={configuredMap} onChange={setActiveTab} />
      <div className="flex min-w-0 flex-1 flex-col">
        <ScrollArea className="flex-1">
          <div className="max-w-2xl space-y-6 p-6">
            <header>
              <h2 className="text-lg font-semibold">{t('settings.webSearch.title')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('settings.webSearch.description')}
              </p>
            </header>
            <div className="border-primary/30 bg-primary/5 rounded-lg border p-4 text-sm">
              <p className="text-foreground font-medium">{t('settings.webSearch.bannerTitle')}</p>
              <p className="text-muted-foreground mt-1 leading-relaxed">
                {t('settings.webSearch.bannerBody')}
              </p>
            </div>
            <div className="border-t pt-6">
              {activeTab === 'common' && <WebSearchCommonParams />}
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
