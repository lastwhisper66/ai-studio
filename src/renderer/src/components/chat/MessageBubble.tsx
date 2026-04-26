import React, { useState, useCallback, useEffect, useRef, memo } from 'react'
import { Copy, Check, Trash2, User, Bot, Clock, RefreshCcw, Pencil } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@renderer/components/ui/avatar'
import { Textarea } from '@renderer/components/ui/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
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
  isEditing?: boolean
  assistantIcon?: string
  userAvatarUrl?: string | null
  onDelete?: (id: string) => void
  onResend?: (messageId: string) => void
  onEdit?: (messageId: string) => void
  onEditSave?: (messageId: string, newContent: string) => void
  onEditSaveAndResend?: (messageId: string, newContent: string) => void
  onEditCancel?: () => void
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
  isEditing,
  assistantIcon,
  userAvatarUrl,
  onDelete,
  onResend,
  onEdit,
  onEditSave,
  onEditSaveAndResend,
  onEditCancel,
}: MessageBubbleProps) {
  const { t } = useTranslation()
  const isUser = role === 'user'
  const { copied, copy } = useCopyToClipboard()
  const elapsed = useElapsedTime(isStreaming ? streamStartTime : null)

  // ── Inline edit state ──
  const [editDraft, setEditDraft] = useState('')
  const [resendConfirmOpen, setResendConfirmOpen] = useState(false)
  const editTextareaRef = useRef<HTMLTextAreaElement>(null)
  const [prevIsEditing, setPrevIsEditing] = useState(false)

  // Sync draft when entering edit mode (React-recommended "adjust state during render" pattern)
  if (!!isEditing !== prevIsEditing) {
    setPrevIsEditing(!!isEditing)
    if (isEditing) {
      setEditDraft(content)
    }
  }

  // Auto-focus + resize when entering edit mode
  useEffect(() => {
    if (!isEditing) return
    requestAnimationFrame(() => {
      const el = editTextareaRef.current
      if (el) {
        el.focus()
        el.style.height = 'auto'
        el.style.height = `${Math.min(el.scrollHeight, 320)}px`
      }
    })
  }, [isEditing])

  useEffect(() => {
    if (!isEditing) return
    const el = editTextareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 320)}px`
    }
  }, [editDraft, isEditing])

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

  const handleEdit = useCallback(() => {
    if (messageId && onEdit) {
      onEdit(messageId)
    }
  }, [messageId, onEdit])

  const handleEditSave = useCallback(() => {
    const trimmed = editDraft.trim()
    if (messageId && trimmed && trimmed !== content && onEditSave) {
      onEditSave(messageId, trimmed)
    } else {
      onEditCancel?.()
    }
  }, [editDraft, content, messageId, onEditSave, onEditCancel])

  const handleEditSaveAndResend = useCallback(() => {
    if (!messageId) return
    const trimmed = editDraft.trim()
    if (trimmed && trimmed !== content && onEditSaveAndResend) {
      onEditSaveAndResend(messageId, trimmed)
    } else {
      // Content unchanged — just cancel edit and resend
      onEditCancel?.()
      onResend?.(messageId)
    }
  }, [editDraft, content, messageId, onEditSaveAndResend, onEditCancel, onResend])

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleEditSave()
      }
      if (e.key === 'Escape') {
        onEditCancel?.()
      }
    },
    [handleEditSave, onEditCancel],
  )

  const showActions = !isStreaming && messageId
  const hasImages = attachments && attachments.some((a) => isImageMime(a.mimeType))
  const showDuration = !isUser && (isStreaming || (duration ?? 0) > 0)
  const isWaiting = isStreaming && !content && !reasoningContent

  return (
    <div
      className={`group flex min-w-0 items-start gap-3 ${isUser ? 'flex-row-reverse pl-11' : 'flex-row pr-11'}`}>
      <Avatar className="h-8 w-8 shrink-0">
        {isUser && userAvatarUrl ? <AvatarImage src={userAvatarUrl} alt="User" /> : null}
        <AvatarFallback
          className={
            isUser ? 'bg-chat-user text-chat-user-foreground' : 'bg-muted text-muted-foreground'
          }>
          {isUser ? (
            <User className="h-4 w-4" />
          ) : assistantIcon ? (
            <span className="text-base leading-none">{assistantIcon}</span>
          ) : (
            <Bot className="h-4 w-4" />
          )}
        </AvatarFallback>
      </Avatar>

      <div
        className={`relative min-w-0 flex-1 overflow-hidden ${
          isUser ? 'flex flex-col items-end' : ''
        }`}>
        <div
          className={`wrap-anywhere overflow-hidden rounded-2xl px-4 py-3 text-sm ${
            isUser
              ? `max-w-full whitespace-pre-wrap bg-chat-user text-chat-user-foreground${isEditing ? ' w-full' : ''}`
              : 'w-full text-foreground'
          }`}>
          {isWaiting ? (
            <div className="space-y-2">
              <div className="h-3 w-48 animate-pulse rounded bg-muted" />
              <div className="h-3 w-36 animate-pulse rounded bg-muted" />
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            </div>
          ) : isUser ? (
            isEditing ? (
              <div className="space-y-2">
                <Textarea
                  ref={editTextareaRef}
                  className="field-sizing-fixed min-h-10 max-h-80 resize-none border-0 bg-transparent p-0 text-sm text-chat-user-foreground shadow-none focus-visible:ring-0"
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  rows={1}
                />
                <div className="flex justify-end gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs text-chat-user-foreground/70 hover:bg-chat-user-foreground/15 dark:hover:bg-chat-user-foreground/20 hover:text-chat-user-foreground"
                    onClick={onEditCancel}>
                    {t('common.cancel')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs text-chat-user-foreground/70 hover:bg-chat-user-foreground/15 dark:hover:bg-chat-user-foreground/20 hover:text-chat-user-foreground"
                    disabled={!editDraft.trim() || editDraft.trim() === content}
                    onClick={handleEditSave}>
                    <Check className="mr-1 h-3 w-3" />
                    {t('common.save')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs text-chat-user-foreground hover:bg-chat-user-foreground/15 dark:hover:bg-chat-user-foreground/20 hover:text-chat-user-foreground"
                    disabled={!editDraft.trim()}
                    onClick={handleEditSaveAndResend}>
                    <RefreshCcw className="mr-1 h-3 w-3" />
                    {t('chat.resend')}
                  </Button>
                </div>
              </div>
            ) : (
              content
            )
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
              <MarkdownRenderer content={content} isStreaming={isStreaming} />
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
            {showActions && !isEditing && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={handleCopy}
                      aria-label={t('chat.copyMessage')}>
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{t('chat.copyMessage')}</TooltipContent>
                </Tooltip>
                {isUser && onEdit && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={handleEdit}
                        aria-label={t('chat.editMessage')}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{t('chat.editMessage')}</TooltipContent>
                  </Tooltip>
                )}
                {onResend && (
                  <Tooltip>
                    <Popover open={resendConfirmOpen} onOpenChange={setResendConfirmOpen}>
                      <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            aria-label={t('chat.resendMessage')}>
                            <RefreshCcw className="h-3 w-3" />
                          </Button>
                        </PopoverTrigger>
                      </TooltipTrigger>
                      <PopoverContent
                        className="w-auto max-w-56 p-3"
                        side="bottom"
                        align={isUser ? 'end' : 'start'}>
                        <p className="mb-2 text-xs text-muted-foreground">
                          {t('chat.resendConfirmDescription')}
                        </p>
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => setResendConfirmOpen(false)}>
                            {t('common.cancel')}
                          </Button>
                          <Button
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => {
                              setResendConfirmOpen(false)
                              handleResend()
                            }}>
                            {t('common.confirm')}
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                    <TooltipContent side="bottom">{t('chat.resendMessage')}</TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={handleDelete}
                      aria-label={t('chat.deleteMessage')}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{t('chat.deleteMessage')}</TooltipContent>
                </Tooltip>
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
