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
    <div className="space-y-5">
      <div className="rounded-xl border bg-card/50 p-5">
        <h3 className="text-muted-foreground mb-4 text-xs font-medium uppercase tracking-wider">
          生成参数
        </h3>
        <div className="space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="temperature">Temperature</Label>
              <span className="text-muted-foreground bg-muted rounded px-2 py-0.5 text-xs font-mono">
                {temperatureValue.toFixed(1)}
              </span>
            </div>
            <Slider
              id="temperature"
              min={0}
              max={2}
              step={0.1}
              value={[temperatureValue]}
              onValueChange={([v]) => onChange('temperature', v.toString())}
            />
            <p className="text-muted-foreground text-xs">
              值越高回复越有创造性，值越低回复越确定和集中。
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="maxTokens">最大 Token 数</Label>
            <Input
              id="maxTokens"
              type="number"
              min={1}
              max={128000}
              value={formState.maxTokens}
              onChange={(e) => onChange('maxTokens', e.target.value)}
            />
            <p className="text-muted-foreground text-xs">模型单次回复的最大 Token 数量。</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card/50 p-5">
        <h3 className="text-muted-foreground mb-4 text-xs font-medium uppercase tracking-wider">
          系统提示词
        </h3>
        <div className="space-y-1.5">
          <Textarea
            id="systemPrompt"
            rows={6}
            value={formState.systemPrompt}
            onChange={(e) => onChange('systemPrompt', e.target.value)}
            placeholder="你是一个有用的助手..."
          />
          <p className="text-muted-foreground text-xs">用于引导模型行为的系统级提示词。</p>
        </div>
      </div>
    </div>
  )
}
