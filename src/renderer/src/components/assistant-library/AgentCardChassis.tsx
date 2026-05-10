import type { ReactNode } from 'react'
import { cn } from '@renderer/lib/utils'

interface AgentCardChassisProps {
  icon: string
  name: string
  topRightBadge?: ReactNode
  description: string
  /** Slot under the description for source / model badges. */
  metaSlot?: ReactNode
  /** Bottom-row primary action (left side). */
  primaryAction: ReactNode
  /** Bottom-row overflow / secondary action (right side). */
  secondaryAction?: ReactNode
  className?: string
}

export function AgentCardChassis({
  icon,
  name,
  topRightBadge,
  description,
  metaSlot,
  primaryAction,
  secondaryAction,
  className,
}: AgentCardChassisProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex h-full flex-col gap-3 rounded-xl border bg-card/50 p-4 shadow-sm transition-colors hover:bg-accent/20',
        className,
      )}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/40 text-2xl leading-none">
          {icon || '🤖'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-sm font-semibold">{name}</h3>
            {topRightBadge}
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {metaSlot && <div className="flex flex-wrap gap-1.5">{metaSlot}</div>}
      <div className="mt-auto flex items-center justify-between gap-2">
        <div className="flex-1">{primaryAction}</div>
        {secondaryAction}
      </div>
    </div>
  )
}
