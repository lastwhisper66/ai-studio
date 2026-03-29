import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { Tabs, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { Search, ChevronDown, ChevronRight, Plus, Minus } from 'lucide-react'
import type { ProviderType, ModelCapability } from '@shared/types'
import { getModelCatalog, type CatalogModel } from './model-catalog'
import { CAPABILITY_CONFIG, ALL_CAPABILITIES } from './capability-config'

interface ModelManageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  providerName: string
  providerType: ProviderType
  providerColor: string
  /** Models already added to this provider (from database) */
  addedModels: { id: string; name: string; group: string }[]
  onAdd: (modelId: string, group: string, capabilities: ModelCapability[]) => Promise<unknown>
  onRemove: (dbId: string) => Promise<void>
}

export function ModelManageDialog({
  open,
  onOpenChange,
  providerName,
  providerType,
  providerColor,
  addedModels,
  onAdd,
  onRemove,
}: ModelManageDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  const catalog = useMemo(() => getModelCatalog(providerType), [providerType])
  const addedNameSet = useMemo(() => new Set(addedModels.map((m) => m.name)), [addedModels])

  // Filter by tab and search
  const filteredModels = useMemo(() => {
    let result = catalog

    // Filter by capability tab
    if (activeTab !== 'all') {
      result = result.filter((m) => m.capabilities.includes(activeTab as ModelCapability))
    }

    // Filter by search keyword
    const q = search.trim().toLowerCase()
    if (q) {
      result = result.filter((m) => m.id.toLowerCase().includes(q))
    }

    return result
  }, [catalog, activeTab, search])

  // Group filtered models
  const groups = useMemo(() => {
    const map = new Map<string, CatalogModel[]>()
    for (const model of filteredModels) {
      const existing = map.get(model.group) || []
      existing.push(model)
      map.set(model.group, existing)
    }
    return map
  }, [filteredModels])

  const toggleGroup = (group: string): void => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }

  const handleAddGroup = async (groupModels: CatalogModel[]): Promise<void> => {
    for (const m of groupModels) {
      if (!addedNameSet.has(m.id)) {
        await onAdd(m.id, m.group, m.capabilities)
      }
    }
  }

  const handleRemoveModel = async (modelId: string): Promise<void> => {
    const dbModel = addedModels.find((m) => m.name === modelId)
    if (dbModel) await onRemove(dbModel.id)
  }

  const isGroupFullyAdded = (groupModels: CatalogModel[]): boolean =>
    groupModels.every((m) => addedNameSet.has(m.id))

  const handleGroupToggle = async (groupModels: CatalogModel[]): Promise<void> => {
    if (isGroupFullyAdded(groupModels)) {
      // Remove all in group
      for (const m of groupModels) {
        await handleRemoveModel(m.id)
      }
    } else {
      await handleAddGroup(groupModels)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[80vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {providerName}
            {t('modelManage.models')}
          </DialogTitle>
        </DialogHeader>

        {/* Search bar */}
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('modelManage.searchPlaceholder')}
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
          <div className="rounded-lg border">
            {groups.size === 0 ? (
              <div className="text-muted-foreground py-8 text-center text-sm">
                {catalog.length === 0 ? t('modelManage.noCatalog') : t('modelManage.noResults')}
              </div>
            ) : (
              Array.from(groups.entries()).map(([groupName, groupModels], idx) => {
                const isCollapsed = collapsedGroups.has(groupName)
                const isLast = idx === groups.size - 1
                const addedCount = groupModels.filter((m) => addedNameSet.has(m.id)).length
                const allAdded = isGroupFullyAdded(groupModels)

                return (
                  <div key={groupName} className={isLast ? '' : 'border-b'}>
                    {/* Group header */}
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => toggleGroup(groupName)}
                        className="hover:bg-accent/30 flex flex-1 items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors">
                        {isCollapsed ? (
                          <ChevronRight className="text-muted-foreground h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="text-muted-foreground h-3.5 w-3.5" />
                        )}
                        <span className="font-medium">{groupName}</span>
                        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          {addedCount > 0
                            ? `${addedCount}/${groupModels.length}`
                            : groupModels.length}
                        </span>
                      </button>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => handleGroupToggle(groupModels)}
                            className="text-muted-foreground hover:text-foreground mr-3 rounded p-1 transition-colors">
                            {allAdded ? (
                              <Minus className="h-3.5 w-3.5" />
                            ) : (
                              <Plus className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {allAdded ? t('modelManage.removeGroup') : t('modelManage.addGroup')}
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    {/* Model items */}
                    {!isCollapsed &&
                      groupModels.map((model) => {
                        const isAdded = addedNameSet.has(model.id)
                        return (
                          <div
                            key={model.id}
                            className={`flex items-center gap-2.5 border-t border-border/40 px-3 py-2 pl-8 ${
                              isAdded ? 'bg-primary/5' : ''
                            }`}>
                            {/* Provider icon */}
                            <span
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                              style={{ backgroundColor: providerColor }}>
                              {providerName.charAt(0).toUpperCase()}
                            </span>

                            {/* Model name */}
                            <span className="min-w-0 flex-1 truncate text-sm">{model.id}</span>

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

                            {/* Add/Remove button */}
                            <button
                              type="button"
                              onClick={() =>
                                isAdded
                                  ? handleRemoveModel(model.id)
                                  : onAdd(model.id, model.group, model.capabilities)
                              }
                              className={`rounded p-1 transition-colors ${
                                isAdded
                                  ? 'text-muted-foreground hover:text-destructive'
                                  : 'text-muted-foreground hover:text-primary'
                              }`}>
                              {isAdded ? (
                                <Minus className="h-3.5 w-3.5" />
                              ) : (
                                <Plus className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        )
                      })}
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
