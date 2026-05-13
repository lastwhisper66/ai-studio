import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Search, Pencil, Trash2, ChevronDown, ChevronRight, X } from 'lucide-react'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@renderer/components/ui/dialog'
import { useModelDefinitionStore } from '@renderer/stores/modelDefinitionStore'
import type { ModelCapability, ModelDefinition, ProviderType } from '@shared/types'
import { CAPABILITY_CONFIG, FULL_CAPABILITIES } from './capability-config'

const ALL_PROVIDER_TYPES: { value: ProviderType; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'openai-response', label: 'OpenAI Response' },
  { value: 'azure', label: 'Azure' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'claude', label: 'Claude' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'silicon', label: 'Silicon Flow' },
  { value: 'newapi', label: 'NewAPI' },
]

export function ModelLibrarySection(): React.JSX.Element {
  const { t } = useTranslation()
  const { definitions, add, update, remove } = useModelDefinitionStore()
  const [search, setSearch] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [editingDef, setEditingDef] = useState<ModelDefinition | null>(null)
  const [deletingDef, setDeletingDef] = useState<ModelDefinition | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)

  // Filter by search
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return definitions
    return definitions.filter(
      (d) => d.name.toLowerCase().includes(q) || d.group.toLowerCase().includes(q),
    )
  }, [definitions, search])

  // Group by group field
  const groups = useMemo(() => {
    const map = new Map<string, ModelDefinition[]>()
    for (const def of filtered) {
      const g = def.group || t('modelLibrary.ungrouped')
      const arr = map.get(g) || []
      arr.push(def)
      map.set(g, arr)
    }
    return map
  }, [filtered, t])

  const toggleGroup = (g: string): void => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(g)) next.delete(g)
      else next.add(g)
      return next
    })
  }

  const handleDelete = async (def: ModelDefinition): Promise<void> => {
    setDeletingDef(def)
  }

  const confirmDelete = async (): Promise<void> => {
    if (deletingDef) {
      await remove(deletingDef.id)
      setDeletingDef(null)
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold">{t('modelLibrary.title')}</h2>
          <p className="text-muted-foreground text-sm">{t('modelLibrary.description')}</p>
        </div>
        <Button size="sm" onClick={() => setShowAddDialog(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          {t('modelLibrary.addDefinition')}
        </Button>
      </div>

      {/* Search */}
      <div className="border-b px-6 py-3">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('modelLibrary.searchPlaceholder')}
            className="pl-9"
          />
        </div>
      </div>

      {/* Model list */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          {groups.size === 0 ? (
            <div className="text-muted-foreground py-12 text-center text-sm">
              {definitions.length === 0 ? t('modelLibrary.empty') : t('modelLibrary.noResults')}
            </div>
          ) : (
            <div className="space-y-1">
              {Array.from(groups.entries()).map(([groupName, groupDefs]) => {
                const isCollapsed = collapsedGroups.has(groupName)
                return (
                  <div key={groupName} className="rounded-lg border">
                    {/* Group header */}
                    <button
                      type="button"
                      onClick={() => toggleGroup(groupName)}
                      className="hover:bg-accent/30 flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors">
                      {isCollapsed ? (
                        <ChevronRight className="text-muted-foreground h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="text-muted-foreground h-3.5 w-3.5" />
                      )}
                      <span className="font-medium">{groupName}</span>
                      <span className="text-muted-foreground text-xs">({groupDefs.length})</span>
                    </button>

                    {/* Items */}
                    {!isCollapsed &&
                      groupDefs.map((def) => (
                        <div
                          key={def.id}
                          className="flex items-center gap-2 border-t border-border/40 px-3 py-2 pl-8">
                          <span className="min-w-0 flex-1 truncate text-sm">{def.name}</span>

                          {/* Capability badges */}
                          <div className="flex gap-1">
                            {def.capabilities.map((cap) => {
                              const cfg = CAPABILITY_CONFIG[cap]
                              if (!cfg) return null
                              const Icon = cfg.icon
                              return (
                                <span
                                  key={cap}
                                  className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                                  style={{ backgroundColor: cfg.color }}>
                                  <Icon className="h-3 w-3" /> {t(cfg.labelKey)}
                                </span>
                              )
                            })}
                          </div>

                          {/* Actions */}
                          <button
                            type="button"
                            onClick={() => setEditingDef(def)}
                            className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(def)}
                            className="text-muted-foreground hover:text-destructive rounded p-1 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Add dialog */}
      <ModelDefinitionDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSave={async (data) => {
          await add(data)
          setShowAddDialog(false)
        }}
      />

      {/* Edit dialog */}
      {editingDef && (
        <ModelDefinitionDialog
          open={!!editingDef}
          onOpenChange={(open) => {
            if (!open) setEditingDef(null)
          }}
          initial={editingDef}
          onSave={async (data) => {
            await update(editingDef.id, data)
            setEditingDef(null)
          }}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deletingDef}
        onOpenChange={(open) => {
          if (!open) setDeletingDef(null)
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('modelLibrary.confirmDelete', { name: deletingDef?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/* ─── Add / Edit Dialog ─── */

interface ModelDefinitionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: ModelDefinition
  onSave: (data: {
    name: string
    group: string
    capabilities: ModelCapability[]
    providerTypes: ProviderType[]
  }) => Promise<void>
}

function ModelDefinitionDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: ModelDefinitionDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const [name, setName] = useState(initial?.name ?? '')
  const [group, setGroup] = useState(initial?.group ?? '')
  const [capabilities, setCapabilities] = useState<ModelCapability[]>(initial?.capabilities ?? [])
  const [providerTypes, setProviderTypes] = useState<ProviderType[]>(initial?.providerTypes ?? [])

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- dialog open reset
      setName(initial?.name ?? '')
      setGroup(initial?.group ?? '')
      setCapabilities(initial?.capabilities ?? [])
      setProviderTypes(initial?.providerTypes ?? [])
    }
  }, [open, initial])

  const toggleCapability = (cap: ModelCapability): void => {
    setCapabilities((prev) => (prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap]))
  }

  const toggleProviderType = (pt: ProviderType): void => {
    setProviderTypes((prev) => (prev.includes(pt) ? prev.filter((p) => p !== pt) : [...prev, pt]))
  }

  const handleSave = async (): Promise<void> => {
    if (!name.trim()) return
    await onSave({ name: name.trim(), group: group.trim(), capabilities, providerTypes })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {initial ? t('modelLibrary.editDefinition') : t('modelLibrary.addDefinition')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Model name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('modelLibrary.modelName')}</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. gpt-4o, deepseek-chat"
            />
          </div>

          {/* Group */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('modelLibrary.group')}</label>
            <Input
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              placeholder="e.g. GPT-4, DeepSeek"
            />
          </div>

          {/* Capabilities */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('modelLibrary.capabilities')}</label>
            <div className="flex flex-wrap gap-2">
              {FULL_CAPABILITIES.map((cap) => {
                const cfg = CAPABILITY_CONFIG[cap]
                if (!cfg) return null
                const isActive = capabilities.includes(cap)
                const Icon = cfg.icon
                return (
                  <button
                    key={cap}
                    type="button"
                    onClick={() => toggleCapability(cap)}
                    className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      isActive
                        ? 'border-transparent text-white'
                        : 'border-border text-muted-foreground hover:border-foreground/30'
                    }`}
                    style={isActive ? { backgroundColor: cfg.color } : undefined}>
                    {isActive && <X className="h-3 w-3" />}
                    <Icon className="h-3 w-3" /> {t(cfg.labelKey)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Provider Types */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('modelLibrary.providerTypes')}</label>
            <p className="text-muted-foreground text-xs">{t('modelLibrary.providerTypesHint')}</p>
            <div className="flex flex-wrap gap-2">
              {ALL_PROVIDER_TYPES.map(({ value, label }) => {
                const isActive = providerTypes.includes(value)
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleProviderType(value)}
                    className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground border-transparent'
                        : 'border-border text-muted-foreground hover:border-foreground/30'
                    }`}>
                    {isActive && <X className="h-3 w-3" />}
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {initial ? t('common.save') : t('modelLibrary.addDefinition')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
