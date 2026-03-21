import { Plus, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@renderer/lib/utils'
import { Switch } from '@renderer/components/ui/switch'
import { useProviderStore } from '@renderer/stores/providerStore'
import { getTemplateByType } from './provider-templates'
import { AddProviderDialog } from './AddProviderDialog'

export function ProviderList(): React.JSX.Element {
  const { t } = useTranslation()
  const {
    providers,
    activeProviderId,
    selectedProviderId,
    setSelectedProviderId,
    setActiveProvider,
    updateProvider,
  } = useProviderStore()

  const handleToggle = async (e: React.MouseEvent, id: string, enabled: boolean): Promise<void> => {
    e.stopPropagation()
    await updateProvider(id, { enabled: !enabled })
  }

  return (
    <div className="flex w-56 shrink-0 flex-col border-r">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-medium">{t('settings.provider.list')}</span>
        <AddProviderDialog>
          <button className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors">
            <Plus className="h-4 w-4" />
          </button>
        </AddProviderDialog>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5">
        {providers.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-center text-sm">
            <p>{t('settings.provider.noProviders')}</p>
            <p className="text-xs">{t('settings.provider.noProvidersHint')}</p>
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
                  className={cn(
                    'group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                    isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
                  )}>
                  <span
                    className="h-3 w-3 shrink-0 rounded-full border border-black/10 dark:border-white/10"
                    style={{ backgroundColor: template?.color ?? '#6b7280' }}
                  />
                  <span className="min-w-0 flex-1 truncate">{provider.name}</span>
                  {isActive && <Check className="text-primary h-3.5 w-3.5 shrink-0" />}
                  <Switch
                    size="sm"
                    checked={provider.enabled}
                    onClick={(e) => handleToggle(e, provider.id, provider.enabled)}
                    className="shrink-0"
                  />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
