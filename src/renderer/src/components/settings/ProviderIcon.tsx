import { cn } from '@renderer/lib/utils'
import type { ProviderType } from '@shared/types'
import { PROVIDER_ICON_MAP } from './provider-icons'

interface ProviderIconProps {
  type: ProviderType
  name: string
  color: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_CONFIG = {
  sm: { container: 'h-4 w-4', img: 'h-3 w-3' },
  md: { container: 'h-5 w-5', img: 'h-4 w-4' },
  lg: { container: 'h-7 w-7', img: 'h-5 w-5' },
} as const

/**
 * Renders a provider brand icon when available, or falls back to a
 * colored circle with the provider's first letter.
 */
export function ProviderIcon({
  type,
  name,
  color,
  size = 'md',
  className,
}: ProviderIconProps): React.JSX.Element {
  const iconSrc = PROVIDER_ICON_MAP[type]
  const { container, img } = SIZE_CONFIG[size]

  if (iconSrc) {
    return (
      <span
        className={cn(
          'flex shrink-0 items-center justify-center overflow-hidden rounded-full',
          container,
          className,
        )}>
        <img src={iconSrc} alt={name} className={cn(img, 'object-cover')} draggable={false} />
      </span>
    )
  }

  // Fallback: letter avatar
  const letter = name.charAt(0).toUpperCase()
  const fontSize = size === 'lg' ? 'text-xs' : 'text-[10px]'
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        container,
        fontSize,
        className,
      )}
      style={{ backgroundColor: color }}>
      {letter}
    </span>
  )
}
