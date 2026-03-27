import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Label } from '@renderer/components/ui/label'
import { Slider } from '@renderer/components/ui/slider'
import { Switch } from '@renderer/components/ui/switch'
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
  wordWrap: boolean
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
  const { t } = useTranslation()
  const [prompt, setPrompt] = useState(settings.systemPrompt)
  const [temperature, setTemperature] = useState(settings.temperature)
  const [wordWrap, setWordWrap] = useState(settings.wordWrap)

  // Sync local state when dialog opens or settings change from outside
  useEffect(() => {
    if (open) {
      setPrompt(settings.systemPrompt)
      setTemperature(settings.temperature)
      setWordWrap(settings.wordWrap)
    }
  }, [open, settings])

  const handleSave = (): void => {
    onSave({ systemPrompt: prompt, temperature, wordWrap })
    onOpenChange(false)
  }

  const handleReset = (): void => {
    setPrompt('')
    setTemperature(0.3)
    setWordWrap(true)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('translate.settings.title')}</DialogTitle>
          <DialogDescription>{t('translate.settings.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('translate.settings.customPrompt')}</Label>
            <Textarea
              placeholder={DEFAULT_PROMPT}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground">{t('translate.settings.promptHint')}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t('translate.settings.temperature')}</Label>
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
              {t('translate.settings.temperatureHint')}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t('translate.settings.wordWrap')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('translate.settings.wordWrapHint')}
              </p>
            </div>
            <Switch checked={wordWrap} onCheckedChange={setWordWrap} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleReset}>
            {t('translate.settings.resetDefault')}
          </Button>
          <Button onClick={handleSave}>{t('common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
