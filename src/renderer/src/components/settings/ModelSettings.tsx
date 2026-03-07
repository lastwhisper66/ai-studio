import { Label } from '@renderer/components/ui/label'
import { Input } from '@renderer/components/ui/input'
import { Slider } from '@renderer/components/ui/slider'
import { Textarea } from '@renderer/components/ui/textarea'
import type { SettingsFormState } from './types'

interface ModelSettingsProps {
  formState: SettingsFormState
  onChange: (field: keyof SettingsFormState, value: string) => void
}

export function ModelSettings({ formState, onChange }: ModelSettingsProps): React.JSX.Element {
  const temperatureValue = parseFloat(formState.temperature) || 0.7

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="temperature">Temperature</Label>
          <span className="text-muted-foreground text-sm">{temperatureValue.toFixed(1)}</span>
        </div>
        <Slider
          id="temperature"
          min={0}
          max={2}
          step={0.1}
          value={[temperatureValue]}
          onValueChange={([v]) => onChange('temperature', v.toString())}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="maxTokens">Max Tokens</Label>
        <Input
          id="maxTokens"
          type="number"
          min={1}
          max={128000}
          value={formState.maxTokens}
          onChange={(e) => onChange('maxTokens', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="systemPrompt">System Prompt</Label>
        <Textarea
          id="systemPrompt"
          rows={4}
          value={formState.systemPrompt}
          onChange={(e) => onChange('systemPrompt', e.target.value)}
          placeholder="You are a helpful assistant..."
        />
      </div>
    </div>
  )
}
