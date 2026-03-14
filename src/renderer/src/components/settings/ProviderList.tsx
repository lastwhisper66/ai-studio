import { Plus, Check } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useProviderStore } from '@renderer/stores/providerStore'
import { getTemplateByType } from './provider-templates'
import { AddProviderDialog } from './AddProviderDialog'

export function ProviderList(): React.JSX.Element {
  const {
    providers,
    activeProviderId,
    selectedProviderId,
    setSelectedProviderId,
    setActiveProvider,
  } = useProviderStore()

  const handleContextMenu = (e: React.MouseEvent): void => {
    e.preventDefault()
    // Simple context menu via native menu would require IPC — for now, use the detail panel buttons
  }

  return (
    <div className="flex w-56 shrink-0 flex-col border-r">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-medium">Providers</span>
        <AddProviderDialog>
          <button className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors">
            <Plus className="h-4 w-4" />
          </button>
        </AddProviderDialog>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5">
        {providers.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-center text-sm">
            <p>No providers yet</p>
            <p className="text-xs">Click + to add one</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {providers.map((provider) => {
              const template = getTemplateByType(provider.type)
              const isSelected = selectedProviderId === provider.id
              const isActive = activeProviderId === provider.id

              return (
                <button
                  key={provider.id}
                  onClick={() => setSelectedProviderId(provider.id)}
                  onDoubleClick={() => setActiveProvider(provider.id)}
                  onContextMenu={(e) => handleContextMenu(e)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                    isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
                    !provider.enabled && 'opacity-50',
                  )}>
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: template?.color ?? '#6b7280' }}
                  />
                  <span className="min-w-0 flex-1 truncate">{provider.name}</span>
                  {isActive && <Check className="text-primary h-3.5 w-3.5 shrink-0" />}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
