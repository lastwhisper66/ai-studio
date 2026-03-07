import { useEffect } from 'react'
import { X } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { useConversationStore } from '@renderer/stores/conversationStore'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'

export function ChatView(): React.JSX.Element {
  const {
    activeConversationId,
    conversations,
    messages,
    error,
    isStreaming,
    streamingContent,
    sendMessage,
    stopGeneration,
    clearError,
  } = useConversationStore()

  const activeConversation = conversations.find((c) => c.id === activeConversationId)

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (!error) return
    const timer = setTimeout(clearError, 5000)
    return () => clearTimeout(timer)
  }, [error, clearError])

  // Cleanup stream listeners on unmount
  useEffect(() => {
    return () => window.api.removeAllStreamListeners()
  }, [])

  return (
    <div className="flex flex-1 flex-col bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center border-b px-6 py-3">
        <h2 className="text-sm font-medium">{activeConversation?.title ?? 'New Chat'}</h2>
      </div>

      {/* Messages area */}
      <MessageList
        messages={messages}
        streamingContent={streamingContent}
        isStreaming={isStreaming}
        hasActiveConversation={!!activeConversationId}
      />

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 border-t border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          <span className="flex-1">{error}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={clearError}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Input area */}
      <MessageInput onSend={sendMessage} onStop={stopGeneration} isStreaming={isStreaming} />
    </div>
  )
}
