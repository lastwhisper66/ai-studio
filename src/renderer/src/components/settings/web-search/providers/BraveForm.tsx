import { useTranslation } from 'react-i18next'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import { Label } from '@renderer/components/ui/label'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { useWebSearchTestConnection } from '../useWebSearchTestConnection'

export function BraveForm(): React.JSX.Element {
  const { t } = useTranslation()
  const settings = useSettingsStore((s) => s.settings)
  const saveSettings = useSettingsStore((s) => s.saveSettings)
  const apiKey = settings['webSearch.braveApiKey'] ?? ''
  const { state, run } = useWebSearchTestConnection('brave')

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>{t('settings.webSearch.apiKey')}</Label>
        <Input
          type="password"
          value={apiKey}
          onChange={(e) => void saveSettings({ 'webSearch.braveApiKey': e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          <a
            href="https://brave.com/search/api/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline">
            brave.com/search/api
          </a>
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          onClick={() => void run({ apiKey })}
          disabled={state.kind === 'busy' || apiKey.length === 0}>
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
