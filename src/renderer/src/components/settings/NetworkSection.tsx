import { ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Switch } from '@renderer/components/ui/switch'
import { Label } from '@renderer/components/ui/label'
import { useSettingsStore } from '@renderer/stores/settingsStore'

export function NetworkSection(): React.JSX.Element {
  const { t } = useTranslation()
  const { settings, saveSettings } = useSettingsStore()
  const skipSsl = settings['app.skipSslVerify'] === 'true'

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-card/50 p-5">
        <h2 className="text-base font-semibold">{t('settings.network.title')}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t('settings.network.description')}</p>
      </div>

      <div className="rounded-xl border bg-card/50 p-5">
        <h3 className="text-sm font-semibold">{t('settings.network.certificate')}</h3>

        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <div>
              <Label className="text-sm font-medium">{t('settings.network.skipSsl')}</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {t('settings.network.skipSslDescription')}
              </p>
            </div>
          </div>
          <Switch
            checked={skipSsl}
            onCheckedChange={(c) => saveSettings({ 'app.skipSslVerify': String(c) })}
          />
        </div>
      </div>
    </div>
  )
}
