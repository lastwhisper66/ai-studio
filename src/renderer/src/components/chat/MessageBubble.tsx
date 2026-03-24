import React, { useState, useCallback, useEffect, useRef, memo } from 'react'
import { Copy, Check, Trash2, User, Bot } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import { Avatar, AvatarFallback } from '@renderer/components/ui/avatar'
import { MarkdownRenderer } from './MarkdownRenderer'
import type { MessageRole, AttachmentMeta } from '@shared/types'
import { isImageMime } from '@shared/types'

interface MessageBubbleProps {
  role: MessageRole
  content: string
  isStreaming?: boolean
  messageId?: string
  attachments?: AttachmentMeta[]
  onDelete?: (id: string) => void
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

function AttachmentImage({
  attachment,
}: {
  attachment: AttachmentMeta
}): React.JSX.Element {
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
  isStreaming,
  messageId,
  attachments,
  onDelete,
}: MessageBubbleProps) {
  const { t } = useTranslation()
  const isUser = role === 'user'
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    return () => clearTimeout(copyTimerRef.current)
  }, [])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content).catch(() => {})
    setCopied(true)
    clearTimeout(copyTimerRef.current)
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000)
  }, [content])

  const handleDelete = useCallback(() => {
    if (messageId && onDelete) {
      onDelete(messageId)
    }
  }, [messageId, onDelete])

  const showActions = !isStreaming && messageId
  const hasImages = attachments && attachments.some((a) => isImageMime(a.mimeType))

  return (
    <div className={`group flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback
          className={
            isUser ? 'bg-chat-user text-chat-user-foreground' : 'bg-muted text-muted-foreground'
          }>
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      <div className="relative max-w-[80%]">
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            isUser
              ? 'whitespace-pre-wrap bg-chat-user text-chat-user-foreground'
              : 'text-foreground'
          }`}>
          {isUser ? content : <MarkdownRenderer content={content} />}
          {isStreaming && (
            <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-current align-text-bottom" />
          )}
        </div>

        {/* Image attachments rendered below the text bubble */}
        {hasImages && <AttachmentImages attachments={attachments!} />}

        {/* Action bar — always visible, positioned at bottom */}
        {showActions && (
          <div
            className={`mt-1 flex items-center gap-0.5 ${
              isUser ? 'justify-end' : 'justify-start'
            }`}>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleCopy}
              aria-label={t('chat.copyMessage')}>
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={handleDelete}
              aria-label={t('chat.deleteMessage')}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
})
