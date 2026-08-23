import type { MiniApp } from '@shared/types'
import { cn } from '@renderer/lib/utils'
import { MINI_APP_ICONS, inferMiniAppIconKey } from '@renderer/lib/inferMiniAppIcon'

const SIZES = {
  xs: { tile: 'h-4 w-4 text-[9px] rounded', px: 14 },
  sm: { tile: 'h-8 w-8 text-sm rounded-md', px: 22 },
  lg: { tile: 'h-12 w-12 text-lg rounded-xl', px: 34 },
} as const

interface MiniAppIconProps {
  /** `url` is optional so the edit dialog can preview an app being typed. */
  app: Pick<MiniApp, 'name' | 'icon' | 'color'> & { url?: string }
  size?: keyof typeof SIZES
  className?: string
}

/**
 * A vendor's brand logo, resolved from the app's URL host. Falls back to the
 * app's glyph on its brand color for anything unrecognized — which also covers
 * self-hosted and intranet apps. Deliberately not a fetched favicon: those need
 * network access per tile and go blank offline.
 */
export function MiniAppIcon({ app, size = 'sm', className }: MiniAppIconProps): React.JSX.Element {
  const { tile, px } = SIZES[size]
  const iconKey = app.url ? inferMiniAppIconKey(app.url) : undefined
  const BrandIcon = iconKey ? MINI_APP_ICONS[iconKey] : undefined

  if (BrandIcon) {
    return (
      <span
        aria-hidden="true"
        className={cn('flex shrink-0 items-center justify-center', tile, className)}>
        <BrandIcon size={px} />
      </span>
    )
  }

  const glyph = app.icon?.trim() || app.name.trim().charAt(0).toUpperCase()
  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: app.color || '#6366f1' }}
      className={cn(
        'flex shrink-0 items-center justify-center font-semibold text-white',
        tile,
        className,
      )}>
      {glyph}
    </span>
  )
}
