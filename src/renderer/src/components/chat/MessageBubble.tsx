import React, { useState, useCallback, useEffect, memo } from 'react'
import { Copy, Check, Trash2, User, Bot, Clock, RefreshCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import { Avatar, AvatarFallback } from '@renderer/components/ui/avatar'
import { MarkdownRenderer } from './MarkdownRenderer'
import { ThinkingBlock } from './ThinkingBlock'
import { useElapsedTime } from '@renderer/hooks/useElapsedTime'
import { useCopyToClipboard } from '@renderer/hooks/useCopyToClipboard'
import type { MessageRole, AttachmentMeta } from '@shared/types'
import { isImageMime } from '@shared/types'

interface MessageBubbleProps {
  role: MessageRole
  content: string
  reasoningContent?: string | null
  isStreaming?: boolean
  isStreamingReasoning?: boolean
  messageId?: string
  attachments?: AttachmentMeta[]
  duration?: number | null
  thinkingDuration?: number | null
  streamStartTime?: number | null
  onDelete?: (id: string) => void
  onResend?: (messageId: string) => void
}

function formatDuration(ms: number): string {
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return `${mins}m ${secs}s`
}

function AttachmentImages({
  attachments,
}: {
  attachments: AttachmentMeta[]
}): React.JSX.Element | null {
  const images = attachments.filter((a) => isImageMime(a.mimeType))
  if (images.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {images.map((att, i) => (
        <AttachmentImage key={i} attachment={att} />
      ))}
    </div>
  )
}

function AttachmentImage({ attachment }: { attachment: AttachmentMeta }): React.JSX.Element {
  const [src, setSrc] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)

  useEffect(() => {
    let cancelled = false
    window.api.readAttachment(attachment.path).then((result) => {
      if (!cancelled && result.success && result.data) {
        setSrc(`data:${attachment.mimeType};base64,${result.data}`)
      }
    })
    return () => {
      cancelled = true
    }
  }, [attachment.path, attachment.mimeType])

  if (!src) {
    return <div className="h-32 w-32 animate-pulse rounded-lg bg-muted" />
  }

  return (
    <>
      <img
        src={src}
        alt={attachment.name}
        className="max-h-64 max-w-xs rounded-lg object-contain cursor-pointer hover:opacity-90 transition-opacity"
        onClick={() => setPreview(true)}
      />
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 cursor-pointer"
          onClick={() => setPreview(false)}>
          <img
            src={src}
            alt={attachment.name}
            className="max-h-[90vh] max-w-[90vw] object-contain"
          />
        </div>
      )}
    </>
  )
}

export const MessageBubble = memo(function MessageBubble({
  role,
  content,
  reasoningContent,
  isStreaming,
  isStreamingReasoning,
  messageId,
  attachments,
  duration,
  thinkingDuration,
  streamStartTime,
  onDelete,
  onResend,
}: MessageBubbleProps) {
  const { t } = useTranslation()
  const isUser = role === 'user'
  const { copied, copy } = useCopyToClipboard()
  const elapsed = useElapsedTime(isStreaming ? streamStartTime : null)

  const handleCopy = useCallback(() => {
    const cleaned = content.replace(/ +$/gm, '')
    copy(cleaned)
  }, [content, copy])

  const handleDelete = useCallback(() => {
    if (messageId && onDelete) {
      onDelete(messageId)
    }
  }, [messageId, onDelete])

  const handleResend = useCallback(() => {
    if (messageId && onResend) {
      onResend(messageId)
    }
  }, [messageId, onResend])

  const showActions = !isStreaming && messageId
  const hasImages = attachments && attachments.some((a) => isImageMime(a.mimeType))
  const showDuration = !isUser && (isStreaming || (duration ?? 0) > 0)
  const isWaiting = isStreaming && !content && !reasoningContent

  return (
    <div
      className={`group flex min-w-0 items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback
          className={
            isUser ? 'bg-chat-user text-chat-user-foreground' : 'bg-muted text-muted-foreground'
          }>
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      <div className="relative min-w-0 max-w-[60%]">
        <div
          className={`wrap-anywhere overflow-hidden rounded-2xl px-4 py-3 text-sm ${
            isUser
              ? 'whitespace-pre-wrap bg-chat-user text-chat-user-foreground'
              : 'text-foreground'
          }`}>
          {isWaiting ? (
            <div className="space-y-2">
              <div className="h-3 w-48 animate-pulse rounded bg-muted" />
              <div className="h-3 w-36 animate-pulse rounded bg-muted" />
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            </div>
          ) : isUser ? (
            content
          ) : (
            <>
              {reasoningContent && (
                <ThinkingBlock
                  content={reasoningContent}
                  isStreaming={isStreamingReasoning}
                  thinkingStartTime={isStreamingReasoning ? streamStartTime : null}
                  thinkingDuration={thinkingDuration}
                />
              )}
              <MarkdownRenderer content={content} />
            </>
          )}
          {isStreaming && !isWaiting && !isStreamingReasoning && (
            <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-current align-text-bottom" />
          )}
        </div>

        {/* Image attachments rendered below the text bubble */}
        {hasImages && <AttachmentImages attachments={attachments!} />}

        {/* Action bar + duration — positioned at bottom */}
        {(showActions || showDuration) && (
          <div
            className={`mt-1 flex items-center gap-0.5 ${
              isUser ? 'justify-end' : 'justify-start'
            }`}>
            {showActions && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleCopy}
                  aria-label={t('chat.copyMessage')}>
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
                {onResend && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={handleResend}
                    aria-label={t('chat.resendMessage')}>
                    <RefreshCcw className="h-3 w-3" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={handleDelete}
                  aria-label={t('chat.deleteMessage')}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </>
            )}
            {showDuration && (
              <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {isStreaming ? formatDuration(elapsed) : formatDuration(duration!)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
})
