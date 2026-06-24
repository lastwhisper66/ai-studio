import { Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { cn } from '@renderer/lib/utils'
import type { ContextTokenUsage } from '@shared/types'

interface ContextUsageRingProps {
  breakdown: ContextTokenUsage
  limit: number | null
  hasModel: boolean
  onConfigure: () => void
}

function formatNumber(value: number): string {
  return value.toLocaleString()
}

function ContextUsageTooltip({
  breakdown,
  limit,
  used,
  percent,
}: {
  breakdown: ContextTokenUsage
  limit: number | null
  used: number
  percent: number
}): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <div className="w-56 space-y-1.5">
      {limit == null ? (
        <p className="text-xs">{t('chat.contextWindowMissing')}</p>
      ) : (
        <div className="flex items-center justify-between gap-4 text-xs font-medium">
          <span>{t('chat.contextTotal')}</span>
          <span className="tabular-nums">
            {t('chat.contextUsage', {
              used: formatNumber(used),
              limit: formatNumber(limit),
              percent,
            })}
          </span>
        </div>
      )}
      <div className="h-px bg-border" />
      <div className="space-y-1 text-xs">
        <div className="flex items-center justify-between gap-4">
          <span>{t('chat.contextSystemPrompt')}</span>
          <span className="tabular-nums">
            {t('chat.contextTokens', { count: formatNumber(breakdown.systemPrompt) })}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span>{t('chat.contextHistory')}</span>
          <span className="tabular-nums">
            {t('chat.contextTokens', { count: formatNumber(breakdown.history) })}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span>{t('chat.contextDraft')}</span>
          <span className="tabular-nums">
            {t('chat.contextTokens', { count: formatNumber(breakdown.draft) })}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span>{t('chat.contextWebSearch')}</span>
          <span className="tabular-nums">
            {t('chat.contextTokens', { count: formatNumber(breakdown.webSearch) })}
          </span>
        </div>
        {limit == null && (
          <div className="flex items-center justify-between gap-4 pt-0.5 font-medium">
            <span>{t('chat.contextTotal')}</span>
            <span className="tabular-nums">
              {t('chat.contextTokens', { count: formatNumber(used) })}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export function ContextUsageRing({
  breakdown,
  limit,
  hasModel,
  onConfigure,
}: ContextUsageRingProps): React.JSX.Element | null {
  const { t } = useTranslation()
  if (!hasModel) return null

  const used = breakdown.systemPrompt + breakdown.history + breakdown.draft + breakdown.webSearch
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
        <TooltipContent side="top">
          <ContextUsageTooltip breakdown={breakdown} limit={limit} used={used} percent={percent} />
        </TooltipContent>
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
            used: formatNumber(used),
            limit: formatNumber(limit),
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
        <ContextUsageTooltip breakdown={breakdown} limit={limit} used={used} percent={percent} />
      </TooltipContent>
    </Tooltip>
  )
}
