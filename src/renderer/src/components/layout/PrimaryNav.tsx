import { Sparkles, MessageSquare, Settings, Sun, Moon } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useTheme } from '@renderer/hooks/useTheme'
import { useSettingsStore } from '@renderer/stores/settingsStore'

export function PrimaryNav(): React.JSX.Element {
  const { theme, setTheme } = useTheme()
  const setDialogOpen = useSettingsStore((s) => s.setDialogOpen)

  const toggleTheme = (): void => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <nav className="flex h-full w-12 shrink-0 flex-col items-center border-r bg-nav-background py-3 text-nav-foreground">
      {/* Logo */}
      <div className="mb-4 flex h-8 w-8 items-center justify-center">
        <Sparkles className="h-5 w-5 text-nav-active" />
      </div>

      {/* Navigation icons */}
      <div className="flex flex-1 flex-col items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-nav-active">
              <MessageSquare className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Chat</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setDialogOpen(true)}>
              <Settings className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Settings</TooltipContent>
        </Tooltip>
      </div>

      {/* Bottom: theme toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Toggle theme</TooltipContent>
      </Tooltip>
    </nav>
  )
}
