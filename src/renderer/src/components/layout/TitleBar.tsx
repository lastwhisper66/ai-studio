import { useState, useEffect } from 'react'
import { Minus, Square, X, PanelLeftClose, PanelLeftOpen, Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface TitleBarProps {
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
}

export function TitleBar({ sidebarCollapsed, onToggleSidebar }: TitleBarProps): React.JSX.Element {
  const { t } = useTranslation()
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    window.api.windowIsMaximized().then(setIsMaximized)
    const cleanup = window.api.onWindowMaximizedChange(setIsMaximized)
    return cleanup
  }, [])

  return (
    <div
      className="flex h-10 shrink-0 items-center bg-nav-background text-nav-foreground"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      {/* Left: App name + sidebar toggle */}
      <div
        className="flex items-center gap-1 pl-4 pr-2"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <span className="mr-1 text-sm font-semibold select-none">AI Studio</span>
        <button
          className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-foreground/10"
          onClick={onToggleSidebar}
          title={sidebarCollapsed ? t('titleBar.expandSidebar') : t('titleBar.collapseSidebar')}>
          {sidebarCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Center: draggable spacer */}
      <div className="flex-1" />

      {/* Right: window controls */}
      <div
        className="flex h-full items-stretch"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          className="flex w-12 items-center justify-center transition-colors hover:bg-foreground/10"
          onClick={() => window.api.windowMinimize()}
          title={t('titleBar.minimize')}>
          <Minus className="h-4 w-4" />
        </button>
        <button
          className="flex w-12 items-center justify-center transition-colors hover:bg-foreground/10"
          onClick={() => window.api.windowMaximize()}
          title={isMaximized ? t('titleBar.restore') : t('titleBar.maximize')}>
          {isMaximized ? <Copy className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
        </button>
        <button
          className="flex w-12 items-center justify-center transition-colors hover:bg-[#e81123] hover:text-white"
          onClick={() => window.api.windowClose()}
          title={t('titleBar.close')}>
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
