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
    <div className="space-y-5">
      <div className="rounded-xl border bg-card/50 p-5">
        <h2 className="text-base font-semibold">默认模型</h2>
        <p className="text-muted-foreground mt-1 text-sm">调整模型参数和系统提示词。</p>
      </div>

      <ModelSettings formState={formState} onChange={onChange} />

      <div className="flex items-center rounded-xl border bg-card/50 p-5">
        <Button onClick={handleSave} disabled={isSaving} size="sm">
          {isSaving ? '保存中...' : '保存'}
        </Button>
      </div>
    </div>
  )
}
