import { Button } from '@renderer/components/ui/button'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { ProviderSettings } from './ProviderSettings'
import { ConnectionTest } from './ConnectionTest'
import { providerKeys } from './formUtils'
import type { SettingsFormState } from './types'

interface ProviderSectionProps {
  formState: SettingsFormState
  onChange: (field: keyof SettingsFormState, value: string) => void
}

export function ProviderSection({ formState, onChange }: ProviderSectionProps): React.JSX.Element {
  const { isSaving, saveSettings } = useSettingsStore()

  const handleSave = async (): Promise<void> => {
    await saveSettings(providerKeys(formState))
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Provider</h2>
        <p className="text-muted-foreground text-sm">Configure your AI provider and API key.</p>
      </div>

      <ProviderSettings formState={formState} onChange={onChange} />

      <div className="border-t pt-4">
        <ConnectionTest formState={formState} />
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  )
}
