import React from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Button } from '@renderer/components/ui/button'
import { MessageBubble } from './MessageBubble'
import { WelcomeScreen } from './WelcomeScreen'
import { useThrottledValue } from '@renderer/hooks/useThrottledValue'
import { useAutoScroll } from '@renderer/hooks/useAutoScroll'
import { useConversationStore } from '@renderer/stores/conversationStore'
import type { Message, Assistant } from '@shared/types'

interface MessageListProps {
  messages: Message[]
  streamingContent: string
  isStreaming: boolean
  isLoading: boolean
  hasActiveConversation: boolean
  hasMoreMessages: boolean
  onSend: (content: string) => void
  onLoadMore: () => void
  assistants?: Assistant[]
  onSelectAssistant?: (id: string) => void
  activeAssistant?: Assistant
}

export function MessageList({
  messages,
  streamingContent,
  isStreaming,
  isLoading,
  hasActiveConversation,
  hasMoreMessages,
  onSend,
  onLoadMore,
  assistants,
  onSelectAssistant,
  activeAssistant,
}: MessageListProps): React.JSX.Element {
  const { t } = useTranslation()
  const deleteMessage = useConversationStore((s) => s.deleteMessage)
  const throttledContent = useThrottledValue(streamingContent, isStreaming)

  const { scrollRef, sentinelRef, isAtBottom, scrollToBottom } = useAutoScroll([
    messages,
    throttledContent,
  ])

  // Show assistant prompt suggestions when conversation has an assistant but no messages yet
  const showAssistantSuggestions =
    hasActiveConversation &&
    activeAssistant &&
    activeAssistant.promptSuggestions.length > 0 &&
    messages.length === 0 &&
    !isStreaming

  return (
    <ScrollArea className="flex-1" viewportRef={scrollRef}>
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        {!hasActiveConversation ? (
          <WelcomeScreen
            onSend={onSend}
            assistants={assistants}
            onSelectAssistant={onSelectAssistant}
          />
        ) : isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>{t('chat.loadingMessages')}</span>
            </div>
          </div>
        ) : showAssistantSuggestions ? (
          <div className="flex h-full items-center justify-center py-20">
            <div className="max-w-md text-center">
              <h3 className="mb-1 text-lg font-semibold">{activeAssistant.name}</h3>
              {activeAssistant.description && (
                <p className="mb-6 text-sm text-muted-foreground">{activeAssistant.description}</p>
              )}
              <div className="flex flex-col gap-2">
                {activeAssistant.promptSuggestions.map((suggestion, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    className="h-auto justify-start rounded-xl px-4 py-3 text-left"
                    onClick={() => onSend(suggestion)}>
                    <span className="line-clamp-2">{suggestion}</span>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ) : messages.length === 0 && !isStreaming ? (
          <div className="flex h-full items-center justify-center py-20">
            <p className="text-muted-foreground">{t('chat.sendMessage')}</p>
          </div>
        ) : (
          <>
            {hasMoreMessages && (
              <div className="flex justify-center py-2">
                <Button variant="ghost" size="sm" onClick={onLoadMore}>
                  {t('chat.loadEarlier')}
                </Button>
              </div>
            )}
            {messages.map((msg) =>
              msg.role === 'divider' ? (
                <div key={msg.id} className="flex items-center gap-3 py-1">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-muted-foreground shrink-0 text-xs">{t('chat.contextDivider')}</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              ) : (
                <MessageBubble
                  key={msg.id}
                  role={msg.role}
                  content={msg.content}
                  messageId={msg.id}
                  onDelete={deleteMessage}
                />
              ),
            )}
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
            aria-label={t('chat.scrollToBottom')}>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      )}
    </ScrollArea>
  )
}
