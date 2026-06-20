import { Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { cn } from '@renderer/lib/utils'

interface ContextUsageRingProps {
  used: number
  limit: number | null
  hasModel: boolean
  onConfigure: () => void
}

export function ContextUsageRing({
  used,
  limit,
  hasModel,
  onConfigure,
}: ContextUsageRingProps): React.JSX.Element | null {
  const { t } = useTranslation()
  if (!hasModel) return null

  const size = 18
  const stroke = 2
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const ratio = limit != null && limit > 0 ? Math.min(used / limit, 1) : 0
  const offset = circumference * (1 - ratio)
  const percent = limit != null && limit > 0 ? Math.round((used / limit) * 100) : 0
  const ringColor = ratio >= 0.9 ? '#ef4444' : ratio >= 0.75 ? '#f59e0b' : 'currentColor'

  if (limit == null) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground flex h-7 w-7 items-center justify-center rounded-md transition-colors"
            onClick={onConfigure}
            aria-label={t('chat.contextWindowMissing')}>
            <span className="relative flex h-[18px] w-[18px] items-center justify-center">
              <svg viewBox={`0 0 ${size} ${size}`} className="h-[18px] w-[18px]">
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeDasharray="2 2"
                  strokeWidth={stroke}
                  opacity={0.7}
                />
              </svg>
              <Settings className="absolute h-2.5 w-2.5" />
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">{t('chat.contextWindowMissing')}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          role="img"
          className={cn(
            'text-primary flex h-7 w-7 items-center justify-center rounded-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            ratio >= 0.75 && 'text-amber-500',
            ratio >= 0.9 && 'text-red-500',
          )}
          aria-label={t('chat.contextUsage', {
            used: used.toLocaleString(),
            limit: limit.toLocaleString(),
            percent,
          })}>
          <svg viewBox={`0 0 ${size} ${size}`} className="h-[18px] w-[18px] -rotate-90">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={stroke}
              opacity={0.18}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={ringColor}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeWidth={stroke}
            />
          </svg>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        {t('chat.contextUsage', {
          used: used.toLocaleString(),
          limit: limit.toLocaleString(),
          percent,
        })}
      </TooltipContent>
    </Tooltip>
  )
}
