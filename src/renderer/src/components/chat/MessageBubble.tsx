import { useState, useCallback, useEffect, useRef, memo } from 'react'
import { Copy, Check, Trash2, User, Bot } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Avatar, AvatarFallback } from '@renderer/components/ui/avatar'
import { MarkdownRenderer } from './MarkdownRenderer'
import type { MessageRole } from '@shared/types'

interface MessageBubbleProps {
  role: MessageRole
  content: string
  isStreaming?: boolean
  messageId?: string
  onDelete?: (id: string) => void
}

export const MessageBubble = memo(function MessageBubble({
  role,
  content,
  isStreaming,
  messageId,
  onDelete,
}: MessageBubbleProps) {
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
              : 'bg-muted text-muted-foreground'
          }`}>
          {isUser ? content : <MarkdownRenderer content={content} />}
          {isStreaming && (
            <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-current align-text-bottom" />
          )}
        </div>

        {/* Hover action bar */}
        {showActions && (
          <div
            className={`absolute -top-8 flex items-center gap-0.5 rounded-md border bg-popover p-0.5 shadow-sm opacity-0 transition-opacity group-hover:opacity-100 ${
              isUser ? 'right-0' : 'left-0'
            }`}>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleCopy}
              aria-label="Copy message">
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={handleDelete}
              aria-label="Delete message">
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
})
