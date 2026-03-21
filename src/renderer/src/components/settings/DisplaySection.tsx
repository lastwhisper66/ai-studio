import { useTranslation } from 'react-i18next'

export function DisplaySection(): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-card/50 p-5">
        <h2 className="text-base font-semibold">{t('settings.display.title')}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t('settings.display.description')}</p>
      </div>

      <div className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
        {t('common.comingSoon')}
      </div>
    </div>
  )
}
