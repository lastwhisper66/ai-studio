import { useTranslation } from 'react-i18next'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import { Label } from '@renderer/components/ui/label'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { useWebSearchTestConnection } from '../useWebSearchTestConnection'

export function SearxngForm(): React.JSX.Element {
  const { t } = useTranslation()
  const settings = useSettingsStore((s) => s.settings)
  const saveSettings = useSettingsStore((s) => s.saveSettings)
  const url = settings['webSearch.searxngUrl'] ?? ''
  const user = settings['webSearch.searxngUsername'] ?? ''
  const pw = settings['webSearch.searxngApiKey'] ?? ''
  const { state, run } = useWebSearchTestConnection('searxng')

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>{t('settings.webSearch.searxngUrl')}</Label>
        <Input
          value={url}
          onChange={(e) => void saveSettings({ 'webSearch.searxngUrl': e.target.value })}
          placeholder="https://searxng.example.com"
        />
      </div>
      <div className="space-y-2">
        <Label>{t('settings.webSearch.username')}</Label>
        <Input
          value={user}
          onChange={(e) => void saveSettings({ 'webSearch.searxngUsername': e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>{t('settings.webSearch.password')}</Label>
        <Input
          type="password"
          value={pw}
          onChange={(e) => void saveSettings({ 'webSearch.searxngApiKey': e.target.value })}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          onClick={() => void run({ searxngUrl: url, searxngAuthUser: user, searxngAuthPass: pw })}
          disabled={state.kind === 'busy' || url.length === 0}>
          {state.kind === 'busy' ? t('settings.webSearch.testing') : t('settings.webSearch.test')}
        </Button>
        {state.kind === 'ok' && (
          <span className="text-sm text-green-600">
            {t('settings.webSearch.testOk', { count: state.count })}
          </span>
        )}
        {state.kind === 'err' && (
          <span className="text-sm text-destructive">
            {t('settings.webSearch.testFailed')}: {state.message}
          </span>
        )}
      </div>
    </div>
  )
}
