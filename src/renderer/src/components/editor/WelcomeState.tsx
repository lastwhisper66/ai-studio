import { FilePen } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function WelcomeState(): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <FilePen size={64} className="mx-auto mb-4 text-muted-foreground opacity-50" />
        <h2 className="mb-2 text-xl font-semibold">{t('editor.welcome.title')}</h2>
        <p className="text-muted-foreground">{t('editor.welcome.description')}</p>
      </div>
    </div>
  )
}
