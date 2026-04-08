import { useEffect, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Switch } from '@renderer/components/ui/switch'
import { Label } from '@renderer/components/ui/label'
import { useSettingsStore } from '@renderer/stores/settingsStore'

export function SecuritySection(): React.JSX.Element {
  const { t } = useTranslation()
  const { settings, saveSettings } = useSettingsStore()
  const [skipSsl, setSkipSsl] = useState(true)

  useEffect(() => {
    setSkipSsl(settings['app.skipSslVerify'] !== 'false')
  }, [settings])

  const handleToggle = (checked: boolean): void => {
    setSkipSsl(checked)
    saveSettings({ 'app.skipSslVerify': String(checked) })
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-card/50 p-5">
        <h2 className="text-base font-semibold">{t('settings.security.title')}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t('settings.security.description')}</p>
      </div>

      <div className="rounded-xl border bg-card/50 p-5">
        <h3 className="text-sm font-semibold">{t('settings.security.network')}</h3>

        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <div>
              <Label className="text-sm font-medium">{t('settings.security.skipSsl')}</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {t('settings.security.skipSslDescription')}
              </p>
            </div>
          </div>
          <Switch checked={skipSsl} onCheckedChange={handleToggle} />
        </div>
      </div>
    </div>
  )
}
