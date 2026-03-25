import { Check, ChevronUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useProviderStore } from '@renderer/stores/providerStore'
import { useConversationStore } from '@renderer/stores/conversationStore'
import { useAssistantStore } from '@renderer/stores/assistantStore'
import { getTemplateByType } from '@renderer/components/settings/provider-templates'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'

export function InputToolbar(): React.JSX.Element {
  const { t } = useTranslation()
  const providers = useProviderStore((s) => s.providers)
  const models = useProviderStore((s) => s.models)

  const conversations = useConversationStore((s) => s.conversations)
  const activeConversationId = useConversationStore((s) => s.activeConversationId)
  const updateConversationModel = useConversationStore((s) => s.updateConversationModel)

  const assistants = useAssistantStore((s) => s.assistants)
  const activeAssistantId = useAssistantStore((s) => s.activeAssistantId)

  // Resolve effective provider + model: conversation-level → assistant-level
  const activeConversation = conversations.find((c) => c.id === activeConversationId)
  const activeAssistant = assistants.find(
    (a) => a.id === (activeConversation?.assistantId ?? activeAssistantId),
  )

  const effectiveProviderId = activeConversation?.providerId ?? activeAssistant?.providerId ?? null
  const effectiveModelName = activeConversation?.model ?? activeAssistant?.model ?? ''

  const enabledProviders = providers.filter((p) => p.enabled)
  const effectiveProvider = providers.find((p) => p.id === effectiveProviderId)
  const template = effectiveProvider ? getTemplateByType(effectiveProvider.type) : undefined

  const displayModel = effectiveModelName || effectiveProvider?.model || t('common.noModelSet')

  const handleSelectModel = (modelName: string, providerId: string): void => {
    updateConversationModel(providerId, modelName)
  }

  if (!effectiveProvider) {
    return <span className="text-muted-foreground text-xs">{t('common.noModelSet')}</span>
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="text-muted-foreground hover:bg-muted flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors">
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: template?.color ?? '#6b7280' }}
          />
          <span>{displayModel}</span>
          <ChevronUp className="h-3 w-3 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        {enabledProviders.map((provider, index) => {
          const providerTemplate = getTemplateByType(provider.type)
          const providerModels = models.filter((m) => m.providerId === provider.id && m.enabled)
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
                      provider.id === effectiveProviderId && m.name === effectiveModelName
                    return (
                      <DropdownMenuItem
                        key={m.id}
                        onClick={() => handleSelectModel(m.name, provider.id)}>
                        <Check className={`mr-2 h-3.5 w-3.5 ${isSelected ? '' : 'invisible'}`} />
                        <span>{m.name}</span>
                      </DropdownMenuItem>
                    )
                  })
                ) : (
                  <DropdownMenuItem disabled>
                    <span className="text-muted-foreground">{t('common.noModelConfigured')}</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
            </div>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
