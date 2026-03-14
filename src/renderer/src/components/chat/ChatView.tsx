import { useEffect } from 'react'
import { X, PanelLeftOpen } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useConversationStore } from '@renderer/stores/conversationStore'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'

interface ChatViewProps {
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
}

export function ChatView({ sidebarCollapsed, onToggleSidebar }: ChatViewProps): React.JSX.Element {
  const {
    activeConversationId,
    conversations,
    messages,
    hasMoreMessages,
    error,
    isLoading,
    isStreaming,
    streamingContent,
    sendMessage,
    stopGeneration,
    loadMoreMessages,
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
        {sidebarCollapsed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="mr-2 h-8 w-8"
                onClick={onToggleSidebar}>
                <PanelLeftOpen className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Expand sidebar</TooltipContent>
          </Tooltip>
        )}
        <h2 className="text-sm font-medium">{activeConversation?.title ?? 'New Chat'}</h2>
      </div>

      {/* Messages area */}
      <MessageList
        messages={messages}
        streamingContent={streamingContent}
        isStreaming={isStreaming}
        isLoading={isLoading}
        hasActiveConversation={!!activeConversationId}
        hasMoreMessages={hasMoreMessages}
        onSend={sendMessage}
        onLoadMore={loadMoreMessages}
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
      <div className="border-t">
        <MessageInput onSend={sendMessage} onStop={stopGeneration} isStreaming={isStreaming} />
      </div>
    </div>
  )
}
