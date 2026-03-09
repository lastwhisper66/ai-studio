import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { MODEL_PRESETS } from '@renderer/lib/chat-config'

export function InputToolbar(): React.JSX.Element {
  const currentModel = useSettingsStore((s) => s.settings['api.model']) || 'gpt-4o'
  const provider = useSettingsStore((s) => s.settings['api.provider']) || 'openai'
  const baseUrl = useSettingsStore((s) => s.settings['api.baseUrl'])
  const saveSettings = useSettingsStore((s) => s.saveSettings)

  const showPresets = provider === 'openai' && !baseUrl

  const handleModelChange = (value: string): void => {
    saveSettings({ 'api.model': value })
  }

  return (
    <div className="flex items-center px-4 pt-3 pb-1">
      <div className="mx-auto flex w-full max-w-3xl items-center">
        {showPresets ? (
          <Select value={currentModel} onValueChange={handleModelChange}>
            <SelectTrigger className="h-7 w-auto gap-1 border-none bg-muted/50 px-2.5 text-xs shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODEL_PRESETS.map((m) => (
                <SelectItem key={m.value} value={m.value} className="text-xs">
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="rounded-md bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">
            {currentModel}
          </span>
        )}
      </div>
    </div>
  )
}
