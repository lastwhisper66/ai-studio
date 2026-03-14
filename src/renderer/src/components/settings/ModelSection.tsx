import { Button } from '@renderer/components/ui/button'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { ModelSettings } from './ModelSettings'
import { modelKeys } from './formUtils'
import type { SettingsFormState } from './types'

interface ModelSectionProps {
  formState: SettingsFormState
  onChange: (field: keyof SettingsFormState, value: string) => void
}

export function ModelSection({ formState, onChange }: ModelSectionProps): React.JSX.Element {
  const { isSaving, saveSettings } = useSettingsStore()

  const handleSave = async (): Promise<void> => {
    await saveSettings(modelKeys(formState))
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Model</h2>
        <p className="text-muted-foreground text-sm">Adjust model parameters and system prompt.</p>
      </div>

      <ModelSettings formState={formState} onChange={onChange} />

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  )
}
