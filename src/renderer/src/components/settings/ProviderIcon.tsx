import { cn } from '@renderer/lib/utils'
import type { ProviderType } from '@shared/types'
import { PROVIDER_ICON_MAP, type BrandIcon } from './provider-icons'

interface ProviderIconProps {
  type: ProviderType
  name: string
  color: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
  /**
   * Overrides the provider's own icon. Model rows pass a model-derived brand
   * here, since a provider often serves other vendors' models.
   */
  icon?: BrandIcon
}

const SIZE_CONFIG = {
  sm: { container: 'h-4 w-4', px: 12 },
  md: { container: 'h-5 w-5', px: 16 },
  lg: { container: 'h-7 w-7', px: 20 },
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
  icon,
}: ProviderIconProps): React.JSX.Element {
  const Icon = icon ?? PROVIDER_ICON_MAP[type]
  const { container, px } = SIZE_CONFIG[size]

  if (Icon) {
    return (
      <span
        className={cn('flex shrink-0 items-center justify-center', container, className)}
        title={name}>
        <Icon size={px} />
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
