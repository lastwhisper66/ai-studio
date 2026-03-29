import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { Search, ChevronDown, ChevronRight, Plus, Minus, Loader2 } from 'lucide-react'

/** A model entry returned by the remote /v1/models API */
export interface RemoteModel {
  id: string
  owned_by?: string
}

interface RemoteModelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  providerName: string
  providerColor: string
  /** Remote models fetched from the API */
  remoteModels: RemoteModel[]
  /** Whether the fetch is still in progress */
  loading: boolean
  /** Error message from the fetch, if any */
  error: string | null
  /** Models already added to this provider (from database) */
  addedModelNames: Set<string>
  onAdd: (modelId: string, group: string) => Promise<unknown>
  onRemove: (modelName: string) => Promise<void>
}

export function RemoteModelDialog({
  open,
  onOpenChange,
  providerName,
  providerColor,
  remoteModels,
  loading,
  error,
  addedModelNames,
  onAdd,
  onRemove,
}: RemoteModelDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  // Reset search when dialog opens
  const handleOpenChange = (nextOpen: boolean): void => {
    if (nextOpen) {
      setSearch('')
      setCollapsedGroups(new Set())
    }
    onOpenChange(nextOpen)
  }

  // Filter by search keyword
  const filteredModels = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return remoteModels
    return remoteModels.filter((m) => m.id.toLowerCase().includes(q))
  }, [remoteModels, search])

  // Group by owned_by
  const groups = useMemo(() => {
    const map = new Map<string, RemoteModel[]>()
    for (const model of filteredModels) {
      const groupName = model.owned_by || model.id
      const existing = map.get(groupName) || []
      existing.push(model)
      map.set(groupName, existing)
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

  const isGroupFullyAdded = (groupModels: RemoteModel[]): boolean =>
    groupModels.every((m) => addedModelNames.has(m.id))

  const handleGroupToggle = async (groupName: string, groupModels: RemoteModel[]): Promise<void> => {
    if (isGroupFullyAdded(groupModels)) {
      await Promise.all(groupModels.map((m) => onRemove(m.id)))
    } else {
      await Promise.all(
        groupModels.filter((m) => !addedModelNames.has(m.id)).map((m) => onAdd(m.id, groupName)),
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex h-[80vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {t('remoteModel.title', { provider: providerName })}
          </DialogTitle>
        </DialogHeader>

        {/* Search bar */}
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('remoteModel.searchPlaceholder')}
            className="pl-9"
          />
        </div>

        {/* Model list */}
        <ScrollArea className="min-h-0 flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12">
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
              <span className="text-muted-foreground text-sm">{t('remoteModel.loading')}</span>
            </div>
          ) : error ? (
            <div className="py-8 text-center">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          ) : (
            <div className="rounded-lg border">
              {groups.size === 0 ? (
                <div className="text-muted-foreground py-8 text-center text-sm">
                  {remoteModels.length === 0
                    ? t('remoteModel.noModels')
                    : t('remoteModel.noResults')}
                </div>
              ) : (
                Array.from(groups.entries()).map(([groupName, groupModels], idx) => {
                  const isCollapsed = collapsedGroups.has(groupName)
                  const isLast = idx === groups.size - 1
                  const addedCount = groupModels.filter((m) => addedModelNames.has(m.id)).length
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
                              onClick={() => handleGroupToggle(groupName, groupModels)}
                              className="text-muted-foreground hover:text-foreground mr-3 rounded p-1 transition-colors">
                              {allAdded ? (
                                <Minus className="h-3.5 w-3.5" />
                              ) : (
                                <Plus className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {allAdded
                              ? t('modelManage.removeGroup')
                              : t('modelManage.addGroup')}
                          </TooltipContent>
                        </Tooltip>
                      </div>

                      {/* Model items */}
                      {!isCollapsed &&
                        groupModels.map((model) => {
                          const isAdded = addedModelNames.has(model.id)
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

                              {/* Add/Remove button */}
                              <button
                                type="button"
                                onClick={() =>
                                  isAdded
                                    ? onRemove(model.id)
                                    : onAdd(model.id, model.owned_by || '')
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
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
