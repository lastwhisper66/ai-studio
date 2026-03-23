import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Label } from '@renderer/components/ui/label'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import { Switch } from '@renderer/components/ui/switch'
import {
  Eye,
  EyeOff,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  Plus,
  Pencil,
  Settings,
  Search,
  ChevronDown,
  ChevronRight,
  Minus,
  Link2,
  HelpCircle,
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
import { useProviderStore } from '@renderer/stores/providerStore'
import type { Provider } from '@shared/types'
import { normalizeBaseUrl } from '@shared/url'
import { getTemplateByType } from './provider-templates'

export function ProviderDetail(): React.JSX.Element {
  const { t } = useTranslation()
  const {
    providers,
    models,
    selectedProviderId,
    activeProviderId,
    updateProvider,
    deleteProvider,
    setActiveProvider,
    addModel,
    removeModel,
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
      isActive={activeProviderId === provider.id}
      providerModels={models.filter((m) => m.providerId === provider.id)}
      onUpdate={updateProvider}
      onDelete={deleteProvider}
      onSetActive={setActiveProvider}
      onAddModel={addModel}
      onRemoveModel={removeModel}
    />
  )
}

interface ProviderFormProps {
  provider: Provider
  isActive: boolean
  providerModels: { id: string; name: string; group: string; enabled: boolean }[]
  onUpdate: (id: string, data: Partial<Provider>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onSetActive: (id: string) => Promise<void>
  onAddModel: (providerId: string, name: string, group?: string) => Promise<unknown>
  onRemoveModel: (id: string) => Promise<void>
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
  isActive,
  providerModels,
  onUpdate,
  onDelete,
  onSetActive,
  onAddModel,
  onRemoveModel,
}: ProviderFormProps): React.JSX.Element {
  const { t } = useTranslation()
  const [showApiKey, setShowApiKey] = useState(false)
  const [draft, setDraft] = useState({
    name: provider.name,
    apiKey: provider.apiKey,
    baseUrl: provider.baseUrl,
    endpoint: provider.endpoint,
    apiVersion: provider.apiVersion,
    deploymentName: provider.deploymentName,
    enabled: provider.enabled,
  })
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [renameDraft, setRenameDraft] = useState('')
  const [newModelName, setNewModelName] = useState('')
  const [newModelGroup, setNewModelGroup] = useState('')
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [showModelSearch, setShowModelSearch] = useState(false)
  const [modelSearch, setModelSearch] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [showAddModel, setShowAddModel] = useState(false)

  const template = getTemplateByType(provider.type)
  const isAzure = provider.type === 'azure'

  useEffect(() => {
    setDraft({
      name: provider.name,
      apiKey: provider.apiKey,
      baseUrl: provider.baseUrl,
      endpoint: provider.endpoint,
      apiVersion: provider.apiVersion,
      deploymentName: provider.deploymentName,
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
    setIsTesting(true)
    setTestResult(null)
    try {
      // Save current draft first
      await onUpdate(provider.id, draft)
      const testProvider: Provider = {
        ...provider,
        ...draft,
        model: providerModels[0]?.name || provider.model,
      }
      const res = await window.api.testProviderConnection(testProvider)
      if (res.success) {
        setTestResult({
          success: true,
          message: res.data || t('settings.provider.connectionSuccess'),
        })
      } else {
        setTestResult({
          success: false,
          message: res.error || t('settings.provider.connectionFailed'),
        })
      }
    } catch (e) {
      setTestResult({ success: false, message: (e as Error).message })
    } finally {
      setIsTesting(false)
    }
  }

  const handleDelete = async (): Promise<void> => {
    await onDelete(provider.id)
  }

  const handleAddModel = async (): Promise<void> => {
    const name = newModelName.trim()
    if (!name) return
    if (providerModels.some((m) => m.name === name)) return
    const group = newModelGroup.trim()
    await onAddModel(provider.id, name, group || undefined)
    setNewModelName('')
    setNewModelGroup('')
  }

  const handleAddModelKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddModel()
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
              size="sm"
              onClick={handleTest}
              disabled={isTesting || !draft.apiKey}
              className="shrink-0 gap-1.5 px-4">
              {isTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {isTesting ? t('settings.provider.testing') : t('settings.provider.test')}
            </Button>
          </div>
          {testResult && (
            <div
              className={`mt-2 flex items-center gap-1.5 text-xs ${testResult.success ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
              {testResult.success ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <XCircle className="h-3.5 w-3.5" />
              )}
              <span className="truncate">{testResult.message}</span>
            </div>
          )}
        </div>

        {/* API Address */}
        {isAzure ? (
          <div className="space-y-4">
            <div>
              <SectionHeader title={t('settings.provider.endpoint')} />
              <Input
                value={draft.endpoint}
                onChange={(e) => change('endpoint', e.target.value)}
                onBlur={() => handleBlurSave('endpoint')}
                placeholder="https://your-resource.openai.azure.com"
              />
            </div>
            <div>
              <SectionHeader title={t('settings.provider.apiVersion')} />
              <Input
                value={draft.apiVersion}
                onChange={(e) => change('apiVersion', e.target.value)}
                onBlur={() => handleBlurSave('apiVersion')}
                placeholder="2024-10-01-preview"
              />
            </div>
            <div>
              <SectionHeader title={t('settings.provider.deploymentName')} />
              <Input
                value={draft.deploymentName}
                onChange={(e) => change('deploymentName', e.target.value)}
                onBlur={() => handleBlurSave('deploymentName')}
                placeholder="my-gpt4o-deployment"
              />
            </div>
          </div>
        ) : (
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
              action={
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors">
                      <Link2 className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t('settings.provider.apiAddressSettings')}</TooltipContent>
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
        )}

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
              Array.from(modelGroups.entries()).map(([groupName, groupModels], idx) => {
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
                        <div
                          key={model.id}
                          className="flex items-center gap-2.5 border-t border-border/40 px-3 py-2 pl-8">
                          <span
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                            style={{ backgroundColor: template?.color ?? '#6b7280' }}>
                            {provider.name.charAt(0).toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm">{model.name}</span>
                          <div className="flex shrink-0 items-center gap-1">
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
                        </div>
                      ))}
                  </div>
                )
              })
            )}
          </div>

          {/* Add model area */}
          <div className="mt-3 flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowAddModel(!showAddModel)}
              className="gap-1.5">
              <Pencil className="h-3.5 w-3.5" />
              {t('settings.provider.manage')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddModel(true)}
              className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              {t('common.add')}
            </Button>
          </div>

          {/* Add model form (shown when toggled) */}
          {showAddModel && (
            <div className="mt-3 space-y-2 rounded-lg border p-3">
              <div className="flex gap-2">
                <Input
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  onKeyDown={handleAddModelKeyDown}
                  placeholder={t('settings.provider.modelNamePlaceholder')}
                  className="flex-1 text-sm"
                />
                <Input
                  value={newModelGroup}
                  onChange={(e) => setNewModelGroup(e.target.value)}
                  onKeyDown={handleAddModelKeyDown}
                  placeholder={t('settings.provider.modelGroupPlaceholder')}
                  className="w-36 text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddModel}
                  disabled={!newModelName.trim()}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {t('common.add')}
                </Button>
              </div>
              {/* Quick add from template */}
              {template && template.defaultModels.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {template.defaultModels
                    .filter((m) => !providerModels.some((pm) => pm.name === m))
                    .map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={async () => {
                          if (providerModels.some((pm) => pm.name === m)) return
                          await onAddModel(provider.id, m)
                        }}
                        className="bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded px-2 py-0.5 text-xs transition-colors">
                        + {m}
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom actions */}
        <div className="flex items-center gap-2 border-t pt-4">
          {!isActive && (
            <Button variant="outline" size="sm" onClick={() => onSetActive(provider.id)}>
              {t('settings.provider.setDefault')}
            </Button>
          )}
          {isActive && (
            <span className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs font-medium">
              {t('settings.provider.currentlyUsed')}
            </span>
          )}
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleDelete}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            {t('settings.provider.delete')}
          </Button>
        </div>
      </div>
    </ScrollArea>
  )
}
