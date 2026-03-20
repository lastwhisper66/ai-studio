import { useState, useEffect } from 'react'
import { Label } from '@renderer/components/ui/label'
import { Slider } from '@renderer/components/ui/slider'
import { Textarea } from '@renderer/components/ui/textarea'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'

export interface TranslateSettings {
  systemPrompt: string
  temperature: number
}

interface TranslateSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: TranslateSettings
  onSave: (settings: TranslateSettings) => void
}

const DEFAULT_PROMPT =
  'You are a professional translator. Translate the following text{source} to {target}. ' +
  'Only output the translation, nothing else. Preserve the original formatting.'

export function TranslateSettingsDialog({
  open,
  onOpenChange,
  settings,
  onSave,
}: TranslateSettingsDialogProps): React.JSX.Element {
  const [prompt, setPrompt] = useState(settings.systemPrompt)
  const [temperature, setTemperature] = useState(settings.temperature)

  // Sync local state when dialog opens or settings change from outside
  useEffect(() => {
    if (open) {
      setPrompt(settings.systemPrompt)
      setTemperature(settings.temperature)
    }
  }, [open, settings])

  const handleSave = (): void => {
    onSave({ systemPrompt: prompt, temperature })
    onOpenChange(false)
  }

  const handleReset = (): void => {
    setPrompt('')
    setTemperature(0.3)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>翻译设置</DialogTitle>
          <DialogDescription>自定义翻译行为。</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>自定义提示词</Label>
            <Textarea
              placeholder={DEFAULT_PROMPT}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground">
              使用 {'{source}'} 和 {'{target}'} 作为源语言和目标语言占位符。留空则使用默认提示词。
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Temperature</Label>
              <span className="text-sm text-muted-foreground">{temperature.toFixed(1)}</span>
            </div>
            <Slider
              value={[temperature]}
              onValueChange={([v]) => setTemperature(v)}
              min={0}
              max={2}
              step={0.1}
            />
            <p className="text-xs text-muted-foreground">
              较低值产生更准确的翻译，较高值更具创造性。默认 0.3。
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleReset}>
            重置默认
          </Button>
          <Button onClick={handleSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
