import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { useProviderStore } from '@renderer/stores/providerStore'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { SettingsSidebar, type SettingsSection } from './SettingsSidebar'
import { ProviderSection } from './ProviderSection'
import { ModelLibrarySection } from './ModelLibrarySection'
import { ModelGroupSection } from './ModelGroupSection'
import { GeneralSection } from './GeneralSection'
import { DisplaySection } from './DisplaySection'
import { NetworkSection } from './NetworkSection'
import { DataSection } from './DataSection'
import { PhrasesSection } from './PhrasesSection'
import { KeyboardShortcutsSection } from './KeyboardShortcutsSection'
import { QuickAssistantSection } from './QuickAssistantSection'
import { SelectionAssistantSection } from './SelectionAssistantSection'
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

      {/* Two-column layout */}
      <div className="flex min-h-0 flex-1">
        <SettingsSidebar activeSection={activeSection} onSectionChange={setActiveSection} />

        {activeSection === 'provider' ? (
          <ProviderSection />
        ) : activeSection === 'model-library' ? (
          <ModelLibrarySection />
        ) : activeSection === 'model-group' ? (
          <ModelGroupSection />
        ) : (
          <ScrollArea className="flex-1">
            <div className="p-6">
              {activeSection === 'general' && <GeneralSection />}
              {activeSection === 'network' && <NetworkSection />}
              {activeSection === 'display' && <DisplaySection />}
              {activeSection === 'data' && <DataSection />}
              {activeSection === 'phrases' && <PhrasesSection />}
              {activeSection === 'keyboard-shortcuts' && <KeyboardShortcutsSection />}
              {activeSection === 'quick-assistant' && <QuickAssistantSection />}
              {activeSection === 'selection-assistant' && <SelectionAssistantSection />}
              {activeSection === 'about' && <AboutSection />}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}
