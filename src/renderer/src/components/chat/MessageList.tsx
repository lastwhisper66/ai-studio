import React from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Button } from '@renderer/components/ui/button'
import { MessageBubble } from './MessageBubble'
import { WelcomeScreen } from './WelcomeScreen'
import { useThrottledValue } from '@renderer/hooks/useThrottledValue'
import { useAutoScroll } from '@renderer/hooks/useAutoScroll'
import { useConversationStore } from '@renderer/stores/conversationStore'
import type { Message } from '@shared/types'

interface MessageListProps {
  messages: Message[]
  streamingContent: string
  isStreaming: boolean
  isLoading: boolean
  hasActiveConversation: boolean
  onSend: (content: string) => void
}

export function MessageList({
  messages,
  streamingContent,
  isStreaming,
  isLoading,
  hasActiveConversation,
  onSend,
}: MessageListProps): React.JSX.Element {
  const deleteMessage = useConversationStore((s) => s.deleteMessage)
  const throttledContent = useThrottledValue(streamingContent, isStreaming)

  const { scrollRef, sentinelRef, isAtBottom, scrollToBottom } = useAutoScroll([
    messages,
    throttledContent,
  ])

  return (
    <ScrollArea className="flex-1" viewportRef={scrollRef}>
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        {!hasActiveConversation ? (
          <WelcomeScreen onSend={onSend} />
        ) : isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading messages...</span>
            </div>
          </div>
        ) : messages.length === 0 && !isStreaming ? (
          <div className="flex h-full items-center justify-center py-20">
            <p className="text-muted-foreground">Send a message to start the conversation.</p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
                messageId={msg.id}
                onDelete={deleteMessage}
              />
            ))}
            {isStreaming && throttledContent && (
              <MessageBubble role="assistant" content={throttledContent} isStreaming />
            )}
          </>
        )}
        <div ref={sentinelRef} />
      </div>

      {/* Jump to bottom button */}
      {!isAtBottom && hasActiveConversation && messages.length > 0 && (
        <div className="sticky bottom-4 flex justify-center">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full shadow-lg"
            onClick={scrollToBottom}
            aria-label="Scroll to bottom">
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      )}
    </ScrollArea>
  )
}
