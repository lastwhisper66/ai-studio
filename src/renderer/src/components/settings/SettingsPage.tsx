import { useState, useEffect } from 'react'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { SettingsSidebar, type SettingsSection } from './SettingsSidebar'
import { ProviderSection } from './ProviderSection'
import { ModelSection } from './ModelSection'
import { GeneralSection } from './GeneralSection'
import { DisplaySection } from './DisplaySection'
import { DEFAULT_FORM, formStateFromSettings } from './formUtils'
import type { SettingsFormState } from './types'

export function SettingsPage(): React.JSX.Element {
  const settings = useSettingsStore((s) => s.settings)
  const [activeSection, setActiveSection] = useState<SettingsSection>('provider')
  const [formState, setFormState] = useState<SettingsFormState>(DEFAULT_FORM)

  // Sync form state when settings are loaded or change
  useEffect(() => {
    setFormState(formStateFromSettings(settings))
  }, [settings])

  const handleChange = (field: keyof SettingsFormState, value: string): void => {
    setFormState((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center border-b px-6">
        <h1 className="text-base font-semibold">Settings</h1>
      </div>

      {/* Two-column layout */}
      <div className="flex min-h-0 flex-1">
        <SettingsSidebar activeSection={activeSection} onSectionChange={setActiveSection} />

        <ScrollArea className="flex-1">
          <div className="mx-auto max-w-2xl p-6">
            {activeSection === 'provider' && (
              <ProviderSection formState={formState} onChange={handleChange} />
            )}
            {activeSection === 'model' && (
              <ModelSection formState={formState} onChange={handleChange} />
            )}
            {activeSection === 'general' && <GeneralSection />}
            {activeSection === 'display' && <DisplaySection />}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
