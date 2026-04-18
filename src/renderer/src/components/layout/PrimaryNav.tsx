import { MessageSquare, Languages, Settings, Sun, Moon, Monitor } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { type Theme } from '@renderer/components/theme/ThemeContext'
import { Button } from '@renderer/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useTheme } from '@renderer/hooks/useTheme'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { useConversationStore } from '@renderer/stores/conversationStore'
import { cn } from '@renderer/lib/utils'

export function PrimaryNav(): React.JSX.Element {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()
  const activeView = useSettingsStore((s) => s.activeView)
  const setActiveView = useSettingsStore((s) => s.setActiveView)
  const requestInputFocus = useConversationStore((s) => s.requestInputFocus)

  const cycleTheme = (): void => {
    const nextTheme: Record<Theme, Theme> = {
      light: 'dark',
      dark: 'system',
      system: 'light',
    }
    setTheme(nextTheme[theme])
  }

  const themeLabel = theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'System'
  const themeIconByMode: Record<Theme, React.JSX.Element> = {
    light: <Sun className="h-5 w-5" />,
    dark: <Moon className="h-5 w-5" />,
    system: <Monitor className="h-5 w-5" />,
  }

  return (
    <nav className="flex h-full w-12 shrink-0 flex-col items-center border-r bg-nav-background py-3 text-nav-foreground">
      {/* Navigation icons */}
      <div className="flex flex-1 flex-col items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-9 w-9', activeView === 'chat' && 'text-nav-active')}
              onClick={() => {
                setActiveView('chat')
                requestInputFocus()
              }}>
              <MessageSquare className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">{t('nav.chat')}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-9 w-9', activeView === 'translate' && 'text-nav-active')}
              onClick={() => setActiveView('translate')}>
              <Languages className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">{t('nav.translate')}</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex flex-col items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              aria-label={`${t('nav.theme')}: ${themeLabel}`}
              onClick={cycleTheme}>
              {themeIconByMode[theme]}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {t('nav.theme')}: {themeLabel}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-9 w-9', activeView === 'settings' && 'text-nav-active')}
              onClick={() => setActiveView('settings')}>
              <Settings className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">{t('nav.settings')}</TooltipContent>
        </Tooltip>
      </div>
    </nav>
  )
}
