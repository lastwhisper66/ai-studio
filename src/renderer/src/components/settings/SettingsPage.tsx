import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { useProviderStore } from '@renderer/stores/providerStore'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { SettingsSidebar, type SettingsSection } from './SettingsSidebar'
import { ProviderSection } from './ProviderSection'
import { ModelManagementSection } from './ModelManagementSection'
import { UtilityModelsSection } from './UtilityModelsSection'
import { GeneralSection } from './GeneralSection'
import { DisplaySection } from './DisplaySection'
import { NetworkSection } from './NetworkSection'
import { DataSection } from './data/DataSection'
import { PhrasesSection } from './PhrasesSection'
import { KeyboardShortcutsSection } from './KeyboardShortcutsSection'
import { QuickAssistantSection } from './QuickAssistantSection'
import { SelectionAssistantSection } from './SelectionAssistantSection'
import { WebSearchSection } from './WebSearchSection'
import { AboutSection } from './AboutSection'

export function SettingsPage(): React.JSX.Element {
  const { t } = useTranslation()
  const loadProviders = useProviderStore((s) => s.loadProviders)
  const consumePendingSection = useSettingsStore((s) => s.consumePendingSection)
  const [activeSection, setActiveSection] = useState<SettingsSection>(
    () => consumePendingSection() ?? 'provider',
  )

  useEffect(() => {
    loadProviders()
  }, [loadProviders])

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center border-b px-6">
        <h1 className="text-base font-semibold">{t('settings.title')}</h1>
      </div>

      {/* Two-column layout. The Provider, Model Management AND Data sections
          render their own internal "list-on-left + detail" so we hand them the
          full pane; everything else gets a scrollable panel of plain forms. */}
      <div className="flex min-h-0 flex-1">
        <SettingsSidebar activeSection={activeSection} onSectionChange={setActiveSection} />

        {activeSection === 'provider' ? (
          <ProviderSection />
        ) : activeSection === 'model-management' ? (
          <ModelManagementSection />
        ) : activeSection === 'data' ? (
          <DataSection />
        ) : (
          <ScrollArea className="flex-1">
            <div className="p-6">
              {activeSection === 'general' && <GeneralSection />}
              {activeSection === 'utility-models' && <UtilityModelsSection />}
              {activeSection === 'network' && <NetworkSection />}
              {activeSection === 'display' && <DisplaySection />}
              {activeSection === 'phrases' && <PhrasesSection />}
              {activeSection === 'keyboard-shortcuts' && <KeyboardShortcutsSection />}
              {activeSection === 'quick-assistant' && <QuickAssistantSection />}
              {activeSection === 'selection-assistant' && <SelectionAssistantSection />}
              {activeSection === 'web-search' && <WebSearchSection />}
              {activeSection === 'about' && <AboutSection />}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}
