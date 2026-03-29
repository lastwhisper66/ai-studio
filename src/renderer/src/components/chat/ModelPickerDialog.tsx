import { useState, useMemo } from 'react'
import { Search, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { Tabs, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { useProviderStore } from '@renderer/stores/providerStore'
import { getTemplateByType } from '@renderer/components/settings/provider-templates'
import {
  CAPABILITY_CONFIG,
  ALL_CAPABILITIES,
} from '@renderer/components/settings/capability-config'
import type { ModelCapability } from '@shared/types'

interface ModelPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedProviderId: string | null
  selectedModelId: string
  onSelect: (providerId: string, modelId: string) => void
}

export function ModelPickerDialog({
  open,
  onOpenChange,
  selectedProviderId,
  selectedModelId,
  onSelect,
}: ModelPickerDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const providers = useProviderStore((s) => s.providers)
  const models = useProviderStore((s) => s.models)

  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('all')

  // Reset search/tab when dialog opens
  const handleOpenChange = (nextOpen: boolean): void => {
    if (nextOpen) {
      setSearch('')
      setActiveTab('all')
    }
    onOpenChange(nextOpen)
  }

  const enabledProviders = useMemo(() => providers.filter((p) => p.enabled), [providers])

  // Filter models by capability tab and search
  const filteredModels = useMemo(() => {
    let result = models.filter((m) => m.enabled)

    if (activeTab !== 'all') {
      result = result.filter((m) => m.capabilities.includes(activeTab as ModelCapability))
    }

    const q = search.trim().toLowerCase()
    if (q) {
      result = result.filter((m) => m.name.toLowerCase().includes(q))
    }

    return result
  }, [models, activeTab, search])

  // Group filtered models by provider
  const providerGroups = useMemo(() => {
    const groups: {
      providerId: string
      providerName: string
      color: string
      models: typeof filteredModels
    }[] = []
    for (const provider of enabledProviders) {
      const providerModels = filteredModels.filter((m) => m.providerId === provider.id)
      if (providerModels.length === 0) continue
      const template = getTemplateByType(provider.type)
      groups.push({
        providerId: provider.id,
        providerName: provider.name,
        color: template?.color ?? '#6b7280',
        models: providerModels,
      })
    }
    return groups
  }, [enabledProviders, filteredModels])

  const handleSelect = (providerId: string, modelId: string): void => {
    onSelect(providerId, modelId)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex h-[70vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('modelPicker.title')}</DialogTitle>
        </DialogHeader>

        {/* Search bar */}
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('modelPicker.searchPlaceholder')}
            className="pl-9"
          />
        </div>

        {/* Capability filter tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList variant="line" className="w-full justify-start gap-0">
            <TabsTrigger value="all" className="text-xs">
              {t('modelManage.tab.all')}
            </TabsTrigger>
            {ALL_CAPABILITIES.map((cap) => (
              <TabsTrigger key={cap} value={cap} className="text-xs">
                {t(CAPABILITY_CONFIG[cap].labelKey)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Model list */}
        <ScrollArea className="min-h-0 flex-1">
          {providerGroups.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center text-sm">
              {enabledProviders.length === 0
                ? t('modelPicker.noProviders')
                : t('modelPicker.noResults')}
            </div>
          ) : (
            <div className="rounded-lg border">
              {providerGroups.map((group, idx) => (
                <div
                  key={group.providerId}
                  className={idx < providerGroups.length - 1 ? 'border-b' : ''}>
                  {/* Provider header */}
                  <div className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: group.color }}
                    />
                    {group.providerName}
                  </div>

                  {/* Model rows */}
                  {group.models.map((model) => {
                    const isSelected =
                      group.providerId === selectedProviderId && model.name === selectedModelId
                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => handleSelect(group.providerId, model.name)}
                        className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-accent ${
                          isSelected ? 'bg-accent/60' : ''
                        }`}>
                        {/* Provider icon */}
                        <span
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                          style={{ backgroundColor: group.color }}>
                          {group.providerName.charAt(0).toUpperCase()}
                        </span>

                        {/* Model name */}
                        <span className="min-w-0 flex-1 truncate text-sm">{model.name}</span>

                        {/* Capability badges */}
                        <div className="flex shrink-0 items-center gap-1">
                          {model.capabilities.map((cap) => {
                            const config = CAPABILITY_CONFIG[cap]
                            const Icon = config.icon
                            return (
                              <Tooltip key={cap}>
                                <TooltipTrigger asChild>
                                  <span
                                    className="inline-flex h-5 w-5 items-center justify-center rounded-full"
                                    style={{
                                      backgroundColor: `color-mix(in srgb, ${config.color} 12%, transparent)`,
                                    }}>
                                    <Icon className="h-3 w-3" style={{ color: config.color }} />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>{t(config.labelKey)}</TooltipContent>
                              </Tooltip>
                            )
                          })}
                        </div>

                        {/* Check mark */}
                        {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
