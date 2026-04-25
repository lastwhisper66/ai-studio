import { useState, useEffect } from 'react'
import {
  Minus,
  Square,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Copy,
  Pin,
  PinOff,
  User,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { Avatar, AvatarFallback, AvatarImage } from '@renderer/components/ui/avatar'
import { useUserAvatar } from '@renderer/hooks/useUserAvatar'
import { UserProfileDialog } from './UserProfileDialog'

interface TitleBarProps {
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
}

export function TitleBar({ sidebarCollapsed, onToggleSidebar }: TitleBarProps): React.JSX.Element {
  const { t } = useTranslation()
  const [isMaximized, setIsMaximized] = useState(false)
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const avatarUrl = useUserAvatar()

  useEffect(() => {
    window.api.windowIsMaximized().then(setIsMaximized)
    const cleanup = window.api.onWindowMaximizedChange(setIsMaximized)
    return cleanup
  }, [])

  useEffect(() => {
    window.api.windowIsAlwaysOnTop().then(setIsAlwaysOnTop)
    const cleanup = window.api.onWindowAlwaysOnTopChange(setIsAlwaysOnTop)
    return cleanup
  }, [])

  return (
    <>
      <div
        className="relative flex h-10 shrink-0 items-center justify-between bg-nav-background text-nav-foreground"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        {/* Left: user avatar + sidebar toggle */}
        <div
          className="z-10 flex items-center gap-1 pl-3 pr-2"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="flex items-center justify-center rounded-full transition-opacity hover:opacity-80"
                onClick={() => setProfileOpen(true)}>
                <Avatar className="h-6 w-6" key={avatarUrl ?? 'no-avatar'}>
                  {avatarUrl && <AvatarImage src={avatarUrl} alt="User" />}
                  <AvatarFallback className="bg-foreground/10">
                    <User className="h-3.5 w-3.5" />
                  </AvatarFallback>
                </Avatar>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t('titleBar.userProfile')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-foreground/10"
                onClick={onToggleSidebar}>
                {sidebarCollapsed ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {sidebarCollapsed ? t('titleBar.expandSidebar') : t('titleBar.collapseSidebar')}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Center: app name — absolute so it's centered across the full title bar */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-semibold select-none">AI Studio</span>
        </div>

        {/* Right: window controls */}
        <div
          className="z-10 flex h-full items-stretch"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="flex w-12 items-center justify-center transition-colors hover:bg-foreground/10"
                onClick={() => window.api.windowToggleAlwaysOnTop()}>
                {isAlwaysOnTop ? (
                  <PinOff className="h-3.5 w-3.5" />
                ) : (
                  <Pin className="h-3.5 w-3.5" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {isAlwaysOnTop ? t('titleBar.unpinFromTop') : t('titleBar.pinOnTop')}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="flex w-12 items-center justify-center transition-colors hover:bg-foreground/10"
                onClick={() => window.api.windowMinimize()}>
                <Minus className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t('titleBar.minimize')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="flex w-12 items-center justify-center transition-colors hover:bg-foreground/10"
                onClick={() => window.api.windowMaximize()}>
                {isMaximized ? (
                  <Copy className="h-3.5 w-3.5" />
                ) : (
                  <Square className="h-3.5 w-3.5" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {isMaximized ? t('titleBar.restore') : t('titleBar.maximize')}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="flex w-12 items-center justify-center transition-colors hover:bg-[#e81123] hover:text-white"
                onClick={() => window.api.windowClose()}>
                <X className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t('titleBar.close')}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <UserProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  )
}
