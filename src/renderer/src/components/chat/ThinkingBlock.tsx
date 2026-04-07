import { useState, memo, useCallback } from 'react'
import { ChevronRight, Brain } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { MarkdownRenderer } from './MarkdownRenderer'
import { useElapsedTime } from '@renderer/hooks/useElapsedTime'

interface ThinkingBlockProps {
  content: string
  isStreaming?: boolean
  /** Timestamp (ms) when thinking started — used to compute elapsed time */
  thinkingStartTime?: number | null
  /** Duration in ms — used for completed messages loaded from DB */
  thinkingDuration?: number | null
}

function formatThinkingTime(ms: number): string {
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}m ${secs}s`
}

export const ThinkingBlock = memo(function ThinkingBlock({
  content,
  isStreaming,
  thinkingStartTime,
  thinkingDuration,
}: ThinkingBlockProps) {
  const { t } = useTranslation()
  // Only tracks user-initiated expand/collapse. Default: collapsed.
  const [manualExpanded, setManualExpanded] = useState(false)
  const elapsed = useElapsedTime(isStreaming ? thinkingStartTime : null)

  // While streaming, always show expanded; after streaming, respect user toggle
  const expanded = isStreaming || manualExpanded

  const toggle = useCallback(() => setManualExpanded((v) => !v), [])

  if (!content) return null

  const displayTime = isStreaming
    ? formatThinkingTime(elapsed)
    : thinkingDuration
      ? formatThinkingTime(thinkingDuration)
      : null

  const headerText = isStreaming
    ? t('chat.thinkingInProgress')
    : displayTime
      ? t('chat.thinkingTime', { time: displayTime })
      : t('chat.thinkingProcess')

  return (
    <div className="mb-2">
      <button
        type="button"
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        onClick={toggle}
        aria-expanded={expanded}
        aria-label={t('chat.thinkingProcess')}>
        <Brain className="h-3.5 w-3.5" />
        <span>{headerText}</span>
        <ChevronRight
          className={`h-3 w-3 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
        />
      </button>

      {expanded ? (
        <div className="mt-1.5 border-l-2 border-muted pl-3 text-sm text-muted-foreground">
          <MarkdownRenderer content={content} />
          {isStreaming && (
            <span className="ml-0.5 inline-block h-3.5 w-1 animate-pulse rounded-sm bg-current align-text-bottom" />
          )}
        </div>
      ) : (
        <div className="mt-1.5 border-l-2 border-muted pl-3 text-sm text-muted-foreground">
          <p className="line-clamp-2 opacity-60">{content.slice(0, 200)}</p>
        </div>
      )}
    </div>
  )
})
