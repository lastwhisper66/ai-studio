import { useState, memo, useCallback, useId } from 'react'
import { ChevronRight, Brain, Copy, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { MarkdownRenderer } from './MarkdownRenderer'
import { useElapsedTime } from '@renderer/hooks/useElapsedTime'
import { useCopyToClipboard } from '@renderer/hooks/useCopyToClipboard'

interface ThinkingBlockProps {
  content: string
  isStreaming?: boolean
  thinkingStartTime?: number | null
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
  const regionId = useId()
  const [manualExpanded, setManualExpanded] = useState(false)
  const { copied, copy } = useCopyToClipboard()
  const elapsed = useElapsedTime(isStreaming ? thinkingStartTime : null)

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
      {/* Header row */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          onClick={toggle}
          aria-expanded={expanded}
          aria-controls={regionId}
          aria-label={t('chat.thinkingProcess')}>
          <Brain className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{headerText}</span>
          <ChevronRight
            className={`h-3 w-3 shrink-0 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
          />
        </button>

        {expanded && !isStreaming && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0 text-muted-foreground"
                onClick={() => copy(content)}
                aria-label={t('chat.copyMessage')}>
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {copied ? t('common.copied') : t('chat.copyMessage')}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Animated collapse via CSS grid trick */}
      <div
        id={regionId}
        role="region"
        aria-label={t('chat.thinkingProcess')}
        className="grid transition-[grid-template-rows] duration-200 ease-in-out"
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}>
        <div className="overflow-hidden min-h-0">
          <div className="mt-1.5 border-l-2 border-muted pl-3 text-sm text-muted-foreground">
            {expanded ? (
              <>
                <MarkdownRenderer content={content} />
                {isStreaming && (
                  <span className="ml-0.5 inline-block h-3.5 w-1 animate-pulse rounded-sm bg-current align-text-bottom" />
                )}
              </>
            ) : (
              <p className="line-clamp-2 opacity-60">{content.slice(0, 200)}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})
