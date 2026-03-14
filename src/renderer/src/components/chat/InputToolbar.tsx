import { useProviderStore } from '@renderer/stores/providerStore'
import { getTemplateByType } from '@renderer/components/settings/provider-templates'

export function InputToolbar(): React.JSX.Element {
  const providers = useProviderStore((s) => s.providers)
  const activeProviderId = useProviderStore((s) => s.activeProviderId)

  const activeProvider = providers.find((p) => p.id === activeProviderId)
  const template = activeProvider ? getTemplateByType(activeProvider.type) : undefined

  if (!activeProvider) {
    return (
      <div className="flex items-center px-4 pt-3 pb-1">
        <div className="mx-auto flex w-full max-w-3xl items-center">
          <span className="text-muted-foreground rounded-md bg-muted/50 px-2.5 py-1 text-xs">
            No provider configured
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center px-4 pt-3 pb-1">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-1.5">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: template?.color ?? '#6b7280' }}
        />
        <span className="text-muted-foreground rounded-md bg-muted/50 px-2.5 py-1 text-xs">
          {activeProvider.model || 'No model set'}
        </span>
      </div>
    </div>
  )
}
