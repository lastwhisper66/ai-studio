import { useTranslation } from 'react-i18next'
import { Globe } from 'lucide-react'
import { Label } from '@renderer/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'zh-CN', label: '简体中文' },
]

export function LanguageSection(): React.JSX.Element {
  const { t, i18n } = useTranslation()

  const handleLanguageChange = (value: string): void => {
    i18n.changeLanguage(value)
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-card/50 p-5">
        <h2 className="text-base font-semibold">{t('settings.language.title')}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t('settings.language.description')}</p>
      </div>

      <div className="rounded-xl border bg-card/50 p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Globe className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <div>
              <Label className="text-sm font-medium">{t('settings.language.label')}</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {t('settings.language.restartHint')}
              </p>
            </div>
          </div>
          <Select value={i18n.resolvedLanguage} onValueChange={handleLanguageChange}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang.value} value={lang.value}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
