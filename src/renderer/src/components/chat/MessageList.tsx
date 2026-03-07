import { useRef, useEffect } from 'react'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { MessageBubble } from './MessageBubble'
import type { Message } from '@shared/types'

interface MessageListProps {
  messages: Message[]
  streamingContent: string
  isStreaming: boolean
  hasActiveConversation: boolean
}

export function MessageList({
  messages,
  streamingContent,
  isStreaming,
  hasActiveConversation,
}: MessageListProps): React.JSX.Element {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        {!hasActiveConversation ? (
          <div className="flex h-full items-center justify-center py-20">
            <div className="max-w-md text-center">
              <h3 className="mb-2 text-2xl font-semibold">Welcome to AI Studio</h3>
              <p className="text-muted-foreground">
                Start a conversation by typing a message below.
              </p>
            </div>
          </div>
        ) : messages.length === 0 && !isStreaming ? (
          <div className="flex h-full items-center justify-center py-20">
            <p className="text-muted-foreground">Send a message to start the conversation.</p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
            ))}
            {isStreaming && streamingContent && (
              <MessageBubble role="assistant" content={streamingContent} isStreaming />
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  )
}
