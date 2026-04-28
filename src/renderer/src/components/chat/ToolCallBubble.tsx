import { useState, memo, useCallback, useId } from 'react'
import { ChevronRight, Wrench, Check, X, Loader2, AlertCircle, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import type { ToolCallData, ToolCallResultData, ToolCallStatus } from '@shared/types'

interface ToolCallBubbleProps {
  toolCalls: ToolCallData[]
  toolResults?: ToolCallResultData[]
  onApprove?: (callId: string) => void
  onReject?: (callId: string) => void
  onApproveAll?: () => void
  onRejectAll?: () => void
}

function StatusIcon({ status }: { status: ToolCallStatus }) {
  switch (status) {
    case 'pending':
      return <Wrench className="size-3.5 text-muted-foreground" />
    case 'approved':
    case 'running':
      return <Loader2 className="size-3.5 animate-spin text-blue-500" />
    case 'completed':
      return <Check className="size-3.5 text-green-500" />
    case 'error':
      return <AlertCircle className="size-3.5 text-destructive" />
    case 'rejected':
      return <X className="size-3.5 text-muted-foreground" />
  }
}

function ToolCallItem({
  call,
  result,
  onApprove,
  onReject,
}: {
  call: ToolCallData
  result?: ToolCallResultData
  onApprove?: (callId: string) => void
  onReject?: (callId: string) => void
}) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const contentId = useId()

  const toggle = useCallback(() => setExpanded((v) => !v), [])

  return (
    <div className="rounded-md border border-border/50 bg-muted/30">
      <div className="flex items-center gap-1.5 px-2.5 py-1.5">
        <button
          type="button"
          onClick={toggle}
          className="flex flex-1 items-center gap-1.5 text-left text-xs"
          aria-expanded={expanded}
          aria-controls={contentId}>
          <ChevronRight
            className={`size-3 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
          <StatusIcon status={call.status} />
          <span className="truncate font-medium text-foreground/80">{call.serverName}</span>
          <span className="text-muted-foreground">/</span>
          <span className="truncate text-foreground/70">{call.toolName}</span>
          {call.autoApprove && call.status !== 'pending' && (
            <ShieldCheck className="size-3 text-green-500/70" />
          )}
        </button>

        {call.status === 'pending' && !call.autoApprove && (
          <div className="flex shrink-0 gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-5 px-1.5 text-[10px]"
              onClick={() => onApprove?.(call.id)}>
              {t('mcp.toolCall.approve')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-5 px-1.5 text-[10px] text-muted-foreground"
              onClick={() => onReject?.(call.id)}>
              {t('mcp.toolCall.reject')}
            </Button>
          </div>
        )}

        {(call.status === 'running' || call.status === 'approved') && (
          <span className="shrink-0 text-[10px] text-blue-500">{t('mcp.toolCall.running')}</span>
        )}

        {call.status === 'completed' && (
          <span className="shrink-0 text-[10px] text-green-500">{t('mcp.toolCall.completed')}</span>
        )}

        {call.status === 'error' && (
          <span className="shrink-0 text-[10px] text-destructive">{t('mcp.toolCall.error')}</span>
        )}

        {call.status === 'rejected' && (
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {t('mcp.toolCall.rejected')}
          </span>
        )}
      </div>

      {expanded && (
        <div id={contentId} className="border-t border-border/30 px-2.5 py-2 text-xs">
          <div className="mb-1 font-medium text-muted-foreground">
            {t('mcp.toolCall.arguments')}
          </div>
          <pre className="max-h-40 overflow-auto rounded bg-muted/50 p-2 text-[11px] leading-relaxed">
            {JSON.stringify(call.arguments, null, 2)}
          </pre>
          {result && (
            <>
              <div className="mb-1 mt-2 font-medium text-muted-foreground">
                {t('mcp.toolCall.result')}
              </div>
              <pre
                className={`max-h-40 overflow-auto rounded p-2 text-[11px] leading-relaxed ${
                  result.isError ? 'bg-destructive/10 text-destructive' : 'bg-muted/50'
                }`}>
                {JSON.stringify(result.content, null, 2)}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export const ToolCallBubble = memo(function ToolCallBubble({
  toolCalls,
  toolResults,
  onApprove,
  onReject,
  onApproveAll,
  onRejectAll,
}: ToolCallBubbleProps) {
  const { t } = useTranslation()
  const hasPending = toolCalls.some((tc) => tc.status === 'pending' && !tc.autoApprove)

  return (
    <div className="my-1.5 flex flex-col gap-1">
      {toolCalls.map((call) => (
        <ToolCallItem
          key={call.id}
          call={call}
          result={toolResults?.find((r) => r.callId === call.id)}
          onApprove={onApprove}
          onReject={onReject}
        />
      ))}
      {hasPending && toolCalls.length > 1 && (
        <div className="flex gap-1.5 pt-0.5">
          <Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={onApproveAll}>
            {t('mcp.toolCall.approveAll')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[11px] text-muted-foreground"
            onClick={onRejectAll}>
            {t('mcp.toolCall.rejectAll')}
          </Button>
        </div>
      )}
    </div>
  )
})
