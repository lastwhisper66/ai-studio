import { Plus, Settings, Sun, Moon } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Separator } from '@renderer/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useTheme } from '@renderer/hooks/useTheme'

export function Sidebar(): React.JSX.Element {
  const { theme, setTheme } = useTheme()

  const toggleTheme = (): void => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <aside className="flex h-full w-70 flex-col border-r border-sidebar-border bg-sidebar-background text-sidebar-foreground">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <h1 className="text-lg font-semibold">AI Studio</h1>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Plus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">New Chat</TooltipContent>
        </Tooltip>
      </div>

      <Separator />

      {/* Conversation list placeholder */}
      <ScrollArea className="flex-1 px-2 py-2">
        <div className="space-y-1">
          {/* Placeholder conversations */}
          <div className="rounded-md bg-sidebar-accent px-3 py-2 text-sm text-sidebar-accent-foreground">
            Welcome conversation
          </div>
          <div className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
            Previous chat...
          </div>
        </div>
      </ScrollArea>

      <Separator />

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleTheme}>
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Toggle theme</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Settings className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Settings</TooltipContent>
        </Tooltip>
      </div>
    </aside>
  )
}
