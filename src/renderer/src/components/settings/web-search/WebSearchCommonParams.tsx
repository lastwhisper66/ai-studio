import { useTranslation } from 'react-i18next'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Switch } from '@renderer/components/ui/switch'
import { useSettingsStore } from '@renderer/stores/settingsStore'

export function WebSearchCommonParams(): React.JSX.Element {
  const { t } = useTranslation()
  const settings = useSettingsStore((s) => s.settings)
  const saveSettings = useSettingsStore((s) => s.saveSettings)

  const maxResults = parseInt(settings['webSearch.maxResults'] ?? '5', 10) || 5
  const timeoutSec = Math.round(
    (parseInt(settings['webSearch.timeoutMs'] ?? '15000', 10) || 15000) / 1000,
  )
  const rewriteQuery = (settings['webSearch.rewriteQuery'] ?? 'true') === 'true'

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">{t('settings.webSearch.commonParams')}</h3>
      <div className="space-y-2">
        <Label>{t('settings.webSearch.maxResults')}</Label>
        <Input
          type="number"
          min={1}
          max={20}
          value={maxResults}
          onChange={(e) => {
            const v = Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 5))
            void saveSettings({ 'webSearch.maxResults': String(v) })
          }}
          className="w-24"
        />
      </div>
      <div className="space-y-2">
        <Label>{t('settings.webSearch.timeoutSec')}</Label>
        <Input
          type="number"
          min={3}
          max={60}
          value={timeoutSec}
          onChange={(e) => {
            const v = Math.max(3, Math.min(60, parseInt(e.target.value, 10) || 15))
            void saveSettings({ 'webSearch.timeoutMs': String(v * 1000) })
          }}
          className="w-24"
        />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">{t('settings.webSearch.rewriteQuery')}</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('settings.webSearch.rewriteQueryHint')}
          </p>
        </div>
        <Switch
          checked={rewriteQuery}
          onCheckedChange={(v) =>
            void saveSettings({ 'webSearch.rewriteQuery': v ? 'true' : 'false' })
          }
        />
      </div>
    </div>
  )
}
