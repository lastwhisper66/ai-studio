import { useTranslation } from 'react-i18next'
import { Label } from '@renderer/components/ui/label'
import { Input } from '@renderer/components/ui/input'
import { useSettingsStore } from '@renderer/stores/settingsStore'

export function MarkdownEditorSection(): React.JSX.Element {
  const { t } = useTranslation()
  const value = useSettingsStore((s) => s.settings['editor.maxFileSizeMb'] ?? '2')
  const saveSettings = useSettingsStore((s) => s.saveSettings)

  const handleChange = (next: string): void => {
    const num = Number(next)
    if (!Number.isFinite(num) || num <= 0) return
    void saveSettings({ 'editor.maxFileSizeMb': next })
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">{t('settings.sections.markdownEditor')}</h2>
      <div className="rounded-xl border bg-card/50 p-5">
        <div className="space-y-2">
          <Label htmlFor="editor-max-file-size">{t('settings.markdownEditor.maxFileSize')}</Label>
          <Input
            id="editor-max-file-size"
            type="number"
            min={1}
            max={100}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            className="w-32"
          />
          <p className="text-sm text-muted-foreground">
            {t('settings.markdownEditor.maxFileSizeDesc')}
          </p>
        </div>
      </div>
    </div>
  )
}
