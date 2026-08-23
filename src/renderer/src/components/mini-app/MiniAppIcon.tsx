import type { MiniApp } from '@shared/types'
import { cn } from '@renderer/lib/utils'

const SIZES = {
  xs: 'h-4 w-4 text-[9px] rounded',
  sm: 'h-8 w-8 text-sm rounded-md',
  lg: 'h-12 w-12 text-lg rounded-xl',
} as const

interface MiniAppIconProps {
  app: Pick<MiniApp, 'name' | 'icon' | 'color'>
  size?: keyof typeof SIZES
  className?: string
}

/**
 * A vendor's glyph on its brand color. Deliberately not a fetched favicon: those
 * need network access per tile and go blank offline.
 */
export function MiniAppIcon({ app, size = 'sm', className }: MiniAppIconProps): React.JSX.Element {
  const glyph = app.icon?.trim() || app.name.trim().charAt(0).toUpperCase()
  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: app.color || '#6366f1' }}
      className={cn(
        'flex shrink-0 items-center justify-center font-semibold text-white',
        SIZES[size],
        className,
      )}>
      {glyph}
    </span>
  )
}
