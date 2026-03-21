import { Check, ChevronUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useProviderStore } from '@renderer/stores/providerStore'
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
  const activeProviderId = useProviderStore((s) => s.activeProviderId)
  const activeModelId = useProviderStore((s) => s.activeModelId)
  const setActiveModel = useProviderStore((s) => s.setActiveModel)

  const enabledProviders = providers.filter((p) => p.enabled)
  const activeProvider = providers.find((p) => p.id === activeProviderId)
  const activeModel = activeModelId ? models.find((m) => m.id === activeModelId) : undefined
  const template = activeProvider ? getTemplateByType(activeProvider.type) : undefined

  const displayModel = activeModel?.name || activeProvider?.model || t('common.noModelSet')

  if (!activeProvider) {
    return <span className="text-muted-foreground text-xs">{t('common.noModelConfigured')}</span>
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
                    const isSelected = provider.id === activeProviderId && m.id === activeModelId
                    return (
                      <DropdownMenuItem
                        key={m.id}
                        onClick={() => setActiveModel(m.id, provider.id)}>
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
