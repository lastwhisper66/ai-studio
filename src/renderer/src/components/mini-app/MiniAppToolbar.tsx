import { useTranslation } from 'react-i18next'
import { ArrowLeft, ArrowRight, RotateCw, House, Copy, ExternalLink, Check } from 'lucide-react'
import type { MiniApp } from '@shared/types'
import { Button } from '@renderer/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useCopyToClipboard } from '@renderer/hooks/useCopyToClipboard'

interface MiniAppToolbarProps {
  app: MiniApp
  currentUrl: string
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
  onBack: () => void
  onForward: () => void
  onReload: () => void
  onHome: () => void
}

export function MiniAppToolbar({
  app,
  currentUrl,
  loading,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  onReload,
  onHome,
}: MiniAppToolbarProps): React.JSX.Element {
  const { t } = useTranslation()
  const { copied, copy } = useCopyToClipboard()

  return (
    <div className="flex h-9 shrink-0 items-center gap-0.5 border-b px-2">
      <IconButton
        label={t('miniApps.toolbar.back')}
        disabled={!canGoBack}
        onClick={onBack}
        icon={<ArrowLeft className="h-4 w-4" />}
      />
      <IconButton
        label={t('miniApps.toolbar.forward')}
        disabled={!canGoForward}
        onClick={onForward}
        icon={<ArrowRight className="h-4 w-4" />}
      />
      <IconButton
        label={t('miniApps.toolbar.reload')}
        onClick={onReload}
        icon={<RotateCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />}
      />
      <IconButton
        label={t('miniApps.toolbar.home')}
        onClick={onHome}
        icon={<House className="h-4 w-4" />}
      />

      <span className="mx-2 flex-1 truncate text-xs text-muted-foreground" title={currentUrl}>
        {currentUrl}
      </span>

      <IconButton
        label={copied ? t('miniApps.toolbar.copied') : t('miniApps.toolbar.copyUrl')}
        onClick={() => copy(currentUrl)}
        icon={
          copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />
        }
      />
      <IconButton
        label={t('miniApps.toolbar.openExternal')}
        onClick={() => window.open(currentUrl, '_blank')}
        icon={<ExternalLink className="h-4 w-4" />}
      />
      <span className="ml-1 max-w-32 truncate text-xs font-medium" title={app.name}>
        {app.name}
      </span>
    </div>
  )
}

function IconButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string
  icon: React.ReactNode
  onClick: () => void
  disabled?: boolean
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}>
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}
