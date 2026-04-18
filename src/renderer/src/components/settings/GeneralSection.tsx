import { useEffect, useState } from 'react'
import { X, Globe, SpellCheck, Power, EyeOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Switch } from '@renderer/components/ui/switch'
import { Label } from '@renderer/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'
import { useSettingsStore } from '@renderer/stores/settingsStore'

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'zh-CN', label: '简体中文' },
]

export function GeneralSection(): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const { settings, saveSettings } = useSettingsStore()
  const [closeToTray, setCloseToTray] = useState(true)
  const [spellCheck, setSpellCheck] = useState(true)
  const [autoLaunch, setAutoLaunch] = useState(false)
  const [startMinimized, setStartMinimized] = useState(false)

  useEffect(() => {
    setCloseToTray(settings['app.closeToTray'] !== 'false')
    setSpellCheck(settings['app.spellCheck'] !== 'false')
    setAutoLaunch(settings['app.autoLaunch'] === 'true')
    setStartMinimized(settings['app.startMinimized'] === 'true')
    // Sync stored language with i18n on load — ensures the renderer respects
    // what was persisted in SQLite (the authoritative source for the main process).
    const storedLang = settings['general.language']
    if (storedLang && storedLang !== i18n.resolvedLanguage) {
      i18n.changeLanguage(storedLang)
    }
  }, [settings, i18n])

  const handleCloseToTrayToggle = (checked: boolean): void => {
    setCloseToTray(checked)
    saveSettings({ 'app.closeToTray': String(checked) })
  }

  const handleSpellCheckToggle = (checked: boolean): void => {
    setSpellCheck(checked)
    saveSettings({ 'app.spellCheck': String(checked) })
  }

  const handleAutoLaunchToggle = (checked: boolean): void => {
    setAutoLaunch(checked)
    saveSettings({ 'app.autoLaunch': String(checked) })
  }

  const handleStartMinimizedToggle = (checked: boolean): void => {
    setStartMinimized(checked)
    saveSettings({ 'app.startMinimized': String(checked) })
  }

  const handleLanguageChange = (value: string): void => {
    i18n.changeLanguage(value)
    saveSettings({ 'general.language': value })
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-card/50 p-5">
        <h2 className="text-base font-semibold">{t('settings.general.title')}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t('settings.general.description')}</p>
      </div>

      {/* Language */}
      <div className="rounded-xl border bg-card/50 p-5">
        <h3 className="text-sm font-semibold">{t('settings.general.language')}</h3>

        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Globe className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <div>
              <Label className="text-sm font-medium">{t('settings.general.languageLabel')}</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {t('settings.general.languageHint')}
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

      {/* Startup */}
      <div className="rounded-xl border bg-card/50 p-5">
        <h3 className="text-sm font-semibold">{t('settings.general.startup')}</h3>

        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Power className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <div>
              <Label className="text-sm font-medium">{t('settings.general.autoLaunch')}</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {t('settings.general.autoLaunchDescription')}
              </p>
            </div>
          </div>
          <Switch checked={autoLaunch} onCheckedChange={handleAutoLaunchToggle} />
        </div>

        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <EyeOff className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <div>
              <Label className="text-sm font-medium">{t('settings.general.startMinimized')}</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {t('settings.general.startMinimizedDescription')}
              </p>
            </div>
          </div>
          <Switch checked={startMinimized} onCheckedChange={handleStartMinimizedToggle} />
        </div>
      </div>

      {/* Window */}
      <div className="rounded-xl border bg-card/50 p-5">
        <h3 className="text-sm font-semibold">{t('settings.general.window')}</h3>

        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <X className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <div>
              <Label className="text-sm font-medium">{t('settings.general.closeToTray')}</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {t('settings.general.closeToTrayDescription')}
              </p>
            </div>
          </div>
          <Switch checked={closeToTray} onCheckedChange={handleCloseToTrayToggle} />
        </div>

        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <SpellCheck className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <div>
              <Label className="text-sm font-medium">{t('settings.general.spellCheck')}</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {t('settings.general.spellCheckDescription')}
              </p>
            </div>
          </div>
          <Switch checked={spellCheck} onCheckedChange={handleSpellCheckToggle} />
        </div>
      </div>
    </div>
  )
}
