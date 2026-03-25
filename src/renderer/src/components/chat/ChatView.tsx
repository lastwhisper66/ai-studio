import { useState, useEffect } from 'react'
import { X, ChevronRight, PanelRightClose, PanelRightOpen, Check, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useConversationStore } from '@renderer/stores/conversationStore'
import { useAssistantStore } from '@renderer/stores/assistantStore'
import { useProviderStore } from '@renderer/stores/providerStore'
import { getTemplateByType } from '@renderer/components/settings/provider-templates'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'
import { AssistantSettingsDialog } from './AssistantSettingsDialog'

interface ChatViewProps {
  topicCollapsed: boolean
  onToggleTopic: () => void
}

export function ChatView({ topicCollapsed, onToggleTopic }: ChatViewProps): React.JSX.Element {
  const { t } = useTranslation()
  const {
    activeConversationId,
    conversations,
    messages,
    hasMoreMessages,
    error,
    isLoading,
    isStreaming,
    streamingContent,
    streamStartTime,
    sendMessage,
    stopGeneration,
    loadMoreMessages,
    clearError,
    createConversation,
    updateConversationModel,
  } = useConversationStore()

  const assistants = useAssistantStore((s) => s.assistants)
  const activeAssistantId = useAssistantStore((s) => s.activeAssistantId)

  const providers = useProviderStore((s) => s.providers)
  const models = useProviderStore((s) => s.models)

  const activeConversation = conversations.find((c) => c.id === activeConversationId)
  const activeAssistant = activeAssistantId
    ? assistants.find((a) => a.id === activeAssistantId)
    : activeConversation?.assistantId
      ? assistants.find((a) => a.id === activeConversation.assistantId)
      : undefined

  // Provider / model display — conversation-level override → assistant-level
  const enabledProviders = providers.filter((p) => p.enabled)
  const resolvedProviderId = activeConversation?.providerId ?? activeAssistant?.providerId ?? null
  const resolvedModelName = activeConversation?.model ?? activeAssistant?.model ?? ''
  const resolvedProvider = providers.find((p) => p.id === resolvedProviderId)
  const resolvedModel = resolvedModelName || resolvedProvider?.model || t('common.noModelSet')
  const template = resolvedProvider ? getTemplateByType(resolvedProvider.type) : undefined

  const [settingsOpen, setSettingsOpen] = useState(false)

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

  const handleSelectAssistant = async (assistantId: string): Promise<void> => {
    await createConversation(undefined, assistantId)
  }

  return (
    <div className="flex flex-1 flex-col bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          {/* Assistant info — clickable */}
          <button
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium transition-colors hover:bg-accent"
            onClick={() => setSettingsOpen(true)}>
            <span>{activeAssistant?.name ?? t('chat.newChat')}</span>
          </button>

          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />

          {/* Provider + Model selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: template?.color ?? '#6b7280' }}
                />
                <span>{resolvedModel}</span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {enabledProviders.map((provider, index) => {
                const providerTemplate = getTemplateByType(provider.type)
                const providerModels = models.filter(
                  (m) => m.providerId === provider.id && m.enabled,
                )
                return (
                  <div key={provider.id}>
                    {index > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: providerTemplate?.color ?? '#6b7280' }}
                        />
                        {provider.name}
                      </DropdownMenuLabel>
                      {providerModels.length > 0 ? (
                        providerModels.map((m) => {
                          const isSelected =
                            provider.id === resolvedProviderId && m.name === resolvedModelName
                          return (
                            <DropdownMenuItem
                              key={m.id}
                              onClick={() => updateConversationModel(provider.id, m.name)}>
                              <Check
                                className={`mr-2 h-3.5 w-3.5 ${isSelected ? '' : 'invisible'}`}
                              />
                              <span>{m.name}</span>
                            </DropdownMenuItem>
                          )
                        })
                      ) : (
                        <DropdownMenuItem disabled>
                          <span className="text-muted-foreground">
                            {t('common.noModelConfigured')}
                          </span>
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuGroup>
                  </div>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Right: topic panel toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleTopic}>
              {topicCollapsed ? (
                <PanelRightOpen className="h-4 w-4" />
              ) : (
                <PanelRightClose className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            {topicCollapsed ? t('chat.expandTopicPanel') : t('chat.collapseTopicPanel')}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Messages area */}
      <MessageList
        messages={messages}
        streamingContent={streamingContent}
        isStreaming={isStreaming}
        isLoading={isLoading}
        hasActiveConversation={!!activeConversationId}
        hasMoreMessages={hasMoreMessages}
        streamStartTime={streamStartTime}
        onSend={sendMessage}
        onLoadMore={loadMoreMessages}
        assistants={assistants}
        onSelectAssistant={handleSelectAssistant}
        activeAssistant={activeAssistant}
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

      {/* Assistant Settings Dialog */}
      <AssistantSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        assistantId={activeAssistant?.id ?? null}
      />
    </div>
  )
}
