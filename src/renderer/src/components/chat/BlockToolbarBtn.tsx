import type { LucideIcon } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'

interface BlockToolbarBtnProps {
  icon: LucideIcon
  tooltip: string
  active?: boolean
  className?: string
  onClick: () => void
}

export function BlockToolbarBtn({
  icon: Icon,
  tooltip,
  active,
  className = '',
  onClick,
}: BlockToolbarBtnProps): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`h-6 w-6 ${active ? 'bg-accent' : ''} ${className}`}
          onClick={onClick}>
          <Icon className="h-3.5 w-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{tooltip}</TooltipContent>
    </Tooltip>
  )
}
