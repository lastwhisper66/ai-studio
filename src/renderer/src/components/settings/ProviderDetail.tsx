import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { SortableItem } from '@renderer/components/ui/sortable-item'
import { Label } from '@renderer/components/ui/label'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import { Switch } from '@renderer/components/ui/switch'
import {
  Eye,
  EyeOff,
  Trash2,
  Plus,
  Settings,
  Search,
  ChevronDown,
  ChevronRight,
  Minus,
  HelpCircle,
  RefreshCw,
} from 'lucide-react'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@renderer/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@renderer/components/ui/alert-dialog'
import { useProviderStore } from '@renderer/stores/providerStore'
import type { Provider, ModelCapability } from '@shared/types'
import { normalizeBaseUrl } from '@shared/url'
import { getTemplateByType } from './provider-templates'
import { CAPABILITY_CONFIG } from './capability-config'
import { AddModelDialog } from './AddModelDialog'
import { EditModelDialog } from './EditModelDialog'
import { ConnectionTestDialog } from './ConnectionTestDialog'
import { RemoteModelDialog, type RemoteModel } from './RemoteModelDialog'
import { ProviderIcon } from './ProviderIcon'

export function ProviderDetail(): React.JSX.Element {
  const { t } = useTranslation()
  const {
    providers,
    models,
    selectedProviderId,
    updateProvider,
    deleteProvider,
    addModel,
    updateModel,
    removeModel,
    removeAllModels,
    reorderModels,
  } = useProviderStore()

  const provider = providers.find((p) => p.id === selectedProviderId)

  if (!provider) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
        {t('settings.provider.selectOrAdd')}
      </div>
    )
  }

  return (
    <ProviderForm
      key={provider.id}
      provider={provider}
      providerModels={models.filter((m) => m.providerId === provider.id)}
      onUpdate={updateProvider}
      onDelete={deleteProvider}
      onAddModel={addModel}
      onUpdateModel={updateModel}
      onRemoveModel={removeModel}
      onRemoveAllModels={removeAllModels}
      onReorderModels={reorderModels}
    />
  )
}

interface ProviderFormProps {
  provider: Provider
  providerModels: {
    id: string
    name: string
    group: string
    enabled: boolean
    capabilities: ModelCapability[]
  }[]
  onUpdate: (id: string, data: Partial<Provider>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onAddModel: (
    providerId: string,
    name: string,
    group?: string,
    capabilities?: ModelCapability[],
  ) => Promise<unknown>
  onUpdateModel: (
    id: string,
    data: { name?: string; group?: string; capabilities?: ModelCapability[] },
  ) => Promise<void>
  onRemoveModel: (id: string) => Promise<void>
  onRemoveAllModels: (providerId: string) => Promise<void>
  onReorderModels: (orderedIds: string[]) => Promise<void>
}

function SectionHeader({
  title,
  icon,
  action,
}: {
  title: string
  icon?: React.ReactNode
  action?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {icon}
      <div className="flex-1" />
      {action}
    </div>
  )
}

function ProviderForm({
  provider,
  providerModels,
  onUpdate,
  onDelete,
  onAddModel,
  onUpdateModel,
  onRemoveModel,
  onRemoveAllModels,
  onReorderModels,
}: ProviderFormProps): React.JSX.Element {
  const { t } = useTranslation()
  const [showApiKey, setShowApiKey] = useState(false)
  const [draft, setDraft] = useState({
    name: provider.name,
    apiKey: provider.apiKey,
    baseUrl: provider.baseUrl,
    enabled: provider.enabled,
  })
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [renameDraft, setRenameDraft] = useState('')
  const [showTestDialog, setShowTestDialog] = useState(false)
  const [showModelSearch, setShowModelSearch] = useState(false)
  const [modelSearch, setModelSearch] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showRemoveAllModelsConfirm, setShowRemoveAllModelsConfirm] = useState(false)
  const [editingModel, setEditingModel] = useState<{
    id: string
    name: string
    group: string
    capabilities: ModelCapability[]
  } | null>(null)

  const template = getTemplateByType(provider.type)

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const isModelSearching = showModelSearch && modelSearch.trim().length > 0

  const handleModelDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = sortedModelIds.indexOf(active.id as string)
    const newIndex = sortedModelIds.indexOf(over.id as string)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(sortedModelIds, oldIndex, newIndex)
    onReorderModels(reordered)
  }

  const canFetchModels =
    provider.type !== 'fujitsu' && !!draft.apiKey && !!(draft.baseUrl || template?.defaultBaseUrl)
  const [isFetchingModels, setIsFetchingModels] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [showRemoteModelDialog, setShowRemoteModelDialog] = useState(false)
  const [remoteModels, setRemoteModels] = useState<RemoteModel[]>([])

  useEffect(() => {
    setDraft({
      name: provider.name,
      apiKey: provider.apiKey,
      baseUrl: provider.baseUrl,
      enabled: provider.enabled,
    })
  }, [provider])

  const change = (field: keyof typeof draft, value: string | boolean): void => {
    setDraft((prev) => ({ ...prev, [field]: value }))
  }

  // Auto-save on blur
  const handleBlurSave = async (field: keyof typeof draft): Promise<void> => {
    if (draft[field] !== provider[field]) {
      await onUpdate(provider.id, { [field]: draft[field] })
    }
  }

  const handleTest = async (): Promise<void> => {
    // Save current draft first, then open test dialog
    await onUpdate(provider.id, draft)
    setShowTestDialog(true)
  }

  const handleDelete = (): void => {
    setShowDeleteConfirm(true)
  }

  const handleConfirmDelete = async (): Promise<void> => {
    await onDelete(provider.id)
  }

  const handleFetchRemoteModels = async (): Promise<void> => {
    if (!canFetchModels) return
    // Open dialog immediately, show loading state inside
    setShowRemoteModelDialog(true)
    setRemoteModels([])
    setIsFetchingModels(true)
    setFetchError(null)
    try {
      // Save current draft first
      await onUpdate(provider.id, draft)
      const result = await window.api.fetchRemoteModels({
        type: provider.type,
        apiKey: draft.apiKey,
        baseUrl: draft.baseUrl,
      })
      if (result.success && result.data) {
        setRemoteModels(result.data)
      } else if (!result.success) {
        setFetchError(result.error || t('settings.provider.fetchModelsFailed'))
      }
    } finally {
      setIsFetchingModels(false)
    }
  }

  const toggleGroup = (group: string): void => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(group)) {
        next.delete(group)
      } else {
        next.add(group)
      }
      return next
    })
  }

  // Group models
  const modelGroups = useMemo(() => {
    const groups = new Map<string, typeof providerModels>()
    const filtered = modelSearch.trim()
      ? providerModels.filter((m) => m.name.toLowerCase().includes(modelSearch.toLowerCase()))
      : providerModels

    for (const model of filtered) {
      const groupName = model.group || model.name
      const existing = groups.get(groupName) || []
      existing.push(model)
      groups.set(groupName, existing)
    }
    return groups
  }, [providerModels, modelSearch])

  // Build flat id list matching the grouped render order for SortableContext
  const sortedModelIds = useMemo(() => {
    const ids: string[] = []
    for (const [, models] of modelGroups.entries()) {
      for (const m of models) ids.push(m.id)
    }
    return ids
  }, [modelGroups])

  return (
    <ScrollArea className="flex-1">
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">{draft.name}</h2>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => {
                  setRenameDraft(draft.name)
                  setShowRenameDialog(true)
                }}
                className="text-muted-foreground hover:text-foreground rounded-md p-1 transition-colors">
                <Settings className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t('settings.provider.providerSettings')}</TooltipContent>
          </Tooltip>
          <div className="flex-1" />
          <Switch
            checked={draft.enabled}
            onCheckedChange={(v) => {
              change('enabled', v)
              onUpdate(provider.id, { enabled: v })
            }}
          />
        </div>

        {/* Rename dialog */}
        <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>{t('settings.provider.providerSettings')}</DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <Label htmlFor="rename-input" className="text-muted-foreground mb-1.5 text-xs">
                {t('settings.provider.providerName')}
              </Label>
              <Input
                id="rename-input"
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && renameDraft.trim()) {
                    const newName = renameDraft.trim()
                    change('name', newName)
                    onUpdate(provider.id, { ...draft, name: newName })
                    setShowRenameDialog(false)
                  }
                }}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setShowRenameDialog(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                size="sm"
                disabled={!renameDraft.trim()}
                onClick={() => {
                  const newName = renameDraft.trim()
                  change('name', newName)
                  onUpdate(provider.id, { ...draft, name: newName })
                  setShowRenameDialog(false)
                }}>
                {t('common.confirm')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* API Key */}
        <div>
          <SectionHeader title={t('settings.provider.apiKey')} />
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showApiKey ? 'text' : 'password'}
                value={draft.apiKey}
                onChange={(e) => change('apiKey', e.target.value)}
                onBlur={() => handleBlurSave('apiKey')}
                placeholder="sk-..."
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-0 right-0 h-full w-10"
                onClick={() => setShowApiKey(!showApiKey)}>
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={!draft.apiKey}
              className="shrink-0 gap-1.5 px-4">
              {t('settings.provider.test')}
            </Button>
          </div>
        </div>

        {/* API Address */}
        <div>
          <SectionHeader
            title={t('settings.provider.apiAddress')}
            icon={
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="text-muted-foreground/50 h-3.5 w-3.5 cursor-help" />
                </TooltipTrigger>
                <TooltipContent>{t('settings.provider.apiAddressTooltip')}</TooltipContent>
              </Tooltip>
            }
          />
          <Input
            value={draft.baseUrl}
            onChange={(e) => change('baseUrl', e.target.value)}
            onBlur={() => handleBlurSave('baseUrl')}
            placeholder={template?.defaultBaseUrl || 'https://api.openai.com'}
          />
          {(() => {
            const raw = draft.baseUrl || template?.defaultBaseUrl || ''
            if (!raw) return null
            const resolved = normalizeBaseUrl(raw, provider.type)
            return (
              <p className="text-muted-foreground mt-1.5 truncate text-xs">
                {t('settings.provider.urlPreview')}：{resolved}/chat/completions
              </p>
            )
          })()}
        </div>

        {/* Models section */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-sm font-semibold">{t('settings.provider.modelCount')}</h3>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {providerModels.length}
            </span>
            <button
              type="button"
              onClick={() => {
                setShowModelSearch((prev) => !prev)
                if (showModelSearch) setModelSearch('')
              }}
              className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors">
              <Search className="h-3.5 w-3.5" />
            </button>
            <div className="flex-1" />
            {providerModels.length > 0 && !(showModelSearch && modelSearch.trim()) && (
              <button
                type="button"
                onClick={() => setShowRemoveAllModelsConfirm(true)}
                className="text-muted-foreground hover:text-destructive flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors">
                <Trash2 className="h-3 w-3" />
                {t('settings.provider.removeAll')}
              </button>
            )}
          </div>

          {/* Model search (shown when toggled) */}
          {showModelSearch && (
            <div className="mb-3">
              <Input
                value={modelSearch}
                onChange={(e) => setModelSearch(e.target.value)}
                placeholder={t('settings.provider.modelNamePlaceholder')}
                className="h-8 text-sm"
                autoFocus
              />
            </div>
          )}

          {/* Grouped model list */}
          <div className="rounded-lg border">
            {modelGroups.size === 0 ? (
              <div className="text-muted-foreground py-6 text-center text-sm">
                {providerModels.length === 0
                  ? t('settings.provider.noModels')
                  : t('settings.provider.noSearchResults')}
              </div>
            ) : (
              <DndContext
                sensors={dndSensors}
                collisionDetection={closestCenter}
                onDragEnd={handleModelDragEnd}>
                <SortableContext items={sortedModelIds} strategy={verticalListSortingStrategy}>
                  {Array.from(modelGroups.entries()).map(([groupName, groupModels], idx) => {
                    const isCollapsed = collapsedGroups.has(groupName)
                    const isLast = idx === modelGroups.size - 1
                    return (
                      <div key={groupName} className={isLast ? '' : 'border-b'}>
                        {/* Group header */}
                        <button
                          type="button"
                          onClick={() => toggleGroup(groupName)}
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent/30">
                          {isCollapsed ? (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          <span className="font-medium">{groupName}</span>
                        </button>

                        {/* Model items */}
                        {!isCollapsed &&
                          groupModels.map((model) => (
                            <SortableItem
                              key={model.id}
                              id={model.id}
                              disabled={isModelSearching}
                              className="gap-2.5 border-t border-border/40 px-3 py-2 pl-4"
                              handleClassName="opacity-0 group-hover:opacity-100 transition-opacity"
                              handleIconSize="h-3.5 w-3.5">
                              <ProviderIcon
                                type={provider.type}
                                name={provider.name}
                                color={template?.color ?? '#6b7280'}
                                size="md"
                              />
                              <span className="min-w-0 flex-1 truncate text-sm">{model.name}</span>
                              {model.capabilities.length > 0 && (
                                <div className="flex shrink-0 items-center gap-0.5">
                                  {model.capabilities.map((cap) => {
                                    const config = CAPABILITY_CONFIG[cap]
                                    if (!config) return null
                                    const Icon = config.icon
                                    return (
                                      <Tooltip key={cap}>
                                        <TooltipTrigger asChild>
                                          <span
                                            className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full"
                                            style={{
                                              backgroundColor: `color-mix(in srgb, ${config.color} 12%, transparent)`,
                                            }}>
                                            <Icon
                                              className="h-2.5 w-2.5"
                                              style={{ color: config.color }}
                                            />
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent>{t(config.labelKey)}</TooltipContent>
                                      </Tooltip>
                                    )
                                  })}
                                </div>
                              )}
                              <div className="flex shrink-0 items-center gap-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={() => setEditingModel(model)}
                                      className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground">
                                      <Settings className="h-3 w-3" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>{t('editModel.title')}</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={() => onRemoveModel(model.id)}
                                      className="rounded p-1 text-muted-foreground transition-colors hover:text-destructive">
                                      <Minus className="h-3.5 w-3.5" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>{t('settings.provider.delete')}</TooltipContent>
                                </Tooltip>
                              </div>
                            </SortableItem>
                          ))}
                      </div>
                    )
                  })}
                </SortableContext>
              </DndContext>
            )}
          </div>

          {/* Add model buttons */}
          <div className="mt-3 flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={handleFetchRemoteModels}
              disabled={!canFetchModels}
              className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              {t('settings.provider.fetchModels')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddDialog(true)}
              className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              {t('common.add')}
            </Button>
          </div>

          {/* Add model dialog (manual input) */}
          <AddModelDialog
            open={showAddDialog}
            onOpenChange={setShowAddDialog}
            existingNames={providerModels.map((m) => m.name)}
            onAdd={(modelId, group, capabilities) =>
              onAddModel(provider.id, modelId, group, capabilities)
            }
          />

          {/* Remote model dialog (fetch from API) */}
          <RemoteModelDialog
            open={showRemoteModelDialog}
            onOpenChange={(open) => {
              setShowRemoteModelDialog(open)
              if (!open) setFetchError(null)
            }}
            providerType={provider.type}
            providerName={provider.name}
            providerColor={template?.color ?? '#6b7280'}
            remoteModels={remoteModels}
            loading={isFetchingModels}
            error={fetchError}
            addedModelNames={new Set(providerModels.map((m) => m.name))}
            onAdd={(modelId, group) => onAddModel(provider.id, modelId, group)}
            onRemove={async (modelName) => {
              const dbModel = providerModels.find((m) => m.name === modelName)
              if (dbModel) await onRemoveModel(dbModel.id)
            }}
          />

          {/* Edit model dialog */}
          {editingModel && (
            <EditModelDialog
              open={!!editingModel}
              onOpenChange={(open) => {
                if (!open) setEditingModel(null)
              }}
              model={editingModel}
              onSave={onUpdateModel}
            />
          )}
        </div>

        {/* Connection test dialog */}
        <ConnectionTestDialog
          open={showTestDialog}
          onOpenChange={setShowTestDialog}
          provider={{ ...provider, ...draft }}
          models={providerModels.map((m) => ({ id: m.id, name: m.name }))}
        />

        {/* Bottom actions */}
        <div className="flex items-center justify-end border-t pt-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleDelete}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            {t('settings.provider.delete')}
          </Button>
        </div>

        {/* Delete confirmation dialog */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>{t('settings.provider.confirmDeleteTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('settings.provider.confirmDeleteDescription', { name: provider.name })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleConfirmDelete}>
                {t('common.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Remove all models confirmation dialog */}
        <AlertDialog open={showRemoveAllModelsConfirm} onOpenChange={setShowRemoveAllModelsConfirm}>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>{t('settings.provider.removeAllTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('settings.provider.removeAllDescription', {
                  count: providerModels.length,
                  name: provider.name,
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => onRemoveAllModels(provider.id)}>
                {t('common.confirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ScrollArea>
  )
}
