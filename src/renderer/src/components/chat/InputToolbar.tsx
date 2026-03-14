import { Check, ChevronUp } from 'lucide-react'
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
  const providers = useProviderStore((s) => s.providers)
  const activeProviderId = useProviderStore((s) => s.activeProviderId)
  const setActiveProvider = useProviderStore((s) => s.setActiveProvider)

  const enabledProviders = providers.filter((p) => p.enabled)
  const activeProvider = providers.find((p) => p.id === activeProviderId)
  const template = activeProvider ? getTemplateByType(activeProvider.type) : undefined

  if (!activeProvider) {
    return (
      <span className="text-muted-foreground text-xs">No provider configured</span>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="text-muted-foreground hover:bg-muted flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors">
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: template?.color ?? '#6b7280' }}
          />
          <span>{activeProvider.model || 'No model set'}</span>
          <ChevronUp className="h-3 w-3 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        {enabledProviders.map((provider, index) => {
          const providerTemplate = getTemplateByType(provider.type)
          const isActive = provider.id === activeProviderId
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
                <DropdownMenuItem onClick={() => setActiveProvider(provider.id)}>
                  <Check className={`mr-2 h-3.5 w-3.5 ${isActive ? '' : 'invisible'}`} />
                  <span>{provider.model || 'No model set'}</span>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </div>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
