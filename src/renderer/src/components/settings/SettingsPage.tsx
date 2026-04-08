import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { useProviderStore } from '@renderer/stores/providerStore'
import { SettingsSidebar, type SettingsSection } from './SettingsSidebar'
import { ProviderSection } from './ProviderSection'
import { ModelLibrarySection } from './ModelLibrarySection'
import { ModelGroupSection } from './ModelGroupSection'
import { GeneralSection } from './GeneralSection'
import { DisplaySection } from './DisplaySection'
import { LanguageSection } from './LanguageSection'
import { SecuritySection } from './SecuritySection'
import { KeyboardShortcutsSection } from './KeyboardShortcutsSection'

export function SettingsPage(): React.JSX.Element {
  const { t } = useTranslation()
  const loadProviders = useProviderStore((s) => s.loadProviders)
  const [activeSection, setActiveSection] = useState<SettingsSection>('provider')

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
              {activeSection === 'security' && <SecuritySection />}
              {activeSection === 'display' && <DisplaySection />}
              {activeSection === 'language' && <LanguageSection />}
              {activeSection === 'keyboard-shortcuts' && <KeyboardShortcutsSection />}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}
