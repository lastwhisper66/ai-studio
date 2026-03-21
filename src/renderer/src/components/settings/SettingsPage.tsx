import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { useProviderStore } from '@renderer/stores/providerStore'
import { SettingsSidebar, type SettingsSection } from './SettingsSidebar'
import { ProviderSection } from './ProviderSection'
import { ModelSection } from './ModelSection'
import { GeneralSection } from './GeneralSection'
import { DisplaySection } from './DisplaySection'
import { LanguageSection } from './LanguageSection'

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
        ) : (
          <ScrollArea className="flex-1">
            <div className="p-6">
              {activeSection === 'model' && <ModelSection />}
              {activeSection === 'general' && <GeneralSection />}
              {activeSection === 'display' && <DisplaySection />}
              {activeSection === 'language' && <LanguageSection />}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}
