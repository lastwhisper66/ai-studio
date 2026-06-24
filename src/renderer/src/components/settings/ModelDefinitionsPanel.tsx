import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Checkbox } from '@renderer/components/ui/checkbox'
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
import { useModelDefinitionStore } from '@renderer/stores/modelDefinitionStore'
import { useModelGroupStore } from '@renderer/stores/modelGroupStore'
import { ModelDefinitionDialog } from './ModelDefinitionDialog'
import { BatchToolbar } from './BatchToolbar'
import { CatalogSyncBanner } from './CatalogSyncBanner'
import { CAPABILITY_CONFIG } from './capability-config'
import type { ModelDefinition } from '@shared/types'
import { type GroupSelection } from './group-selection'

export interface ModelDefinitionsPanelProps {
  selection: GroupSelection
}

/** Format a context-window byte count as compact text (e.g. 128000 -> "128K"). */
function formatContextWindow(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000
    return `${Number.isInteger(v) ? v : v.toFixed(1)}M`
  }
  if (n >= 1_000) {
    const v = n / 1_000
    return `${Number.isInteger(v) ? v : v.toFixed(1)}K`
  }
  return String(n)
}

export function ModelDefinitionsPanel({
  selection,
}: ModelDefinitionsPanelProps): React.JSX.Element {
  const { t } = useTranslation()
  const { definitions, add, update, remove } = useModelDefinitionStore()
  const resolveDefinitionGroup = useModelGroupStore((s) => s.resolveDefinitionGroup)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editing, setEditing] = useState<ModelDefinition | null>(null)
  const [deleting, setDeleting] = useState<ModelDefinition | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Clear selection when the left-pane filter changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset selection on filter switch
    setSelectedIds(new Set())
  }, [selection])

  const filtered = useMemo(() => {
    // Search ignores the left-pane filter — it searches across all groups.
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      return definitions.filter((d) => d.name.toLowerCase().includes(q))
    }
    if (selection.kind === 'all') return definitions
    if (selection.kind === 'unmatched') {
      return definitions.filter((d) => !resolveDefinitionGroup(d))
    }
    return definitions.filter((d) => resolveDefinitionGroup(d) === selection.displayName)
  }, [definitions, selection, resolveDefinitionGroup, searchQuery])

  // Pre-fill the dialog's `group` field when adding inside a named group.
  const defaultGroupForAdd = selection.kind === 'group' ? selection.displayName : undefined
  const selectedDefs = filtered.filter((d) => selectedIds.has(d.id))
  const allChecked = filtered.length > 0 && filtered.every((d) => selectedIds.has(d.id))

  const toggleOne = (id: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = (): void => {
    if (allChecked) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((d) => d.id)))
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <CatalogSyncBanner />
      {/* Header row: select-all + count + search + Add Model | batch actions + Delete */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Select all" />
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {selectedIds.size} / {filtered.length}
        </span>
        <div className="relative w-56">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('modelLibrary.searchPlaceholder')}
            className="h-7 pl-7 text-xs"
          />
        </div>
        <Button size="sm" onClick={() => setShowAddDialog(true)} className="h-7 gap-1 text-xs">
          <Plus className="h-3 w-3" />
          {t('modelLibrary.addDefinition')}
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <BatchToolbar
            selected={selectedDefs}
            onUpdateCapabilities={(id, caps) => update(id, { capabilities: caps })}
            onDelete={(id) => remove(id)}
            onBatchDone={() => setSelectedIds(new Set())}
          />
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        {filtered.length === 0 ? (
          <div className="text-muted-foreground py-12 text-center text-sm">
            {definitions.length === 0 ? t('modelLibrary.empty') : t('modelLibrary.noResults')}
          </div>
        ) : (
          <div className="divide-y border-b">
            {filtered.map((def) => {
              const isSelected = selectedIds.has(def.id)
              return (
                <div
                  key={def.id}
                  className={`group flex items-center gap-2 px-3 py-2 transition-colors ${
                    isSelected ? 'bg-accent/50' : 'hover:bg-accent/30'
                  }`}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleOne(def.id)}
                    aria-label={`Select ${def.name}`}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">{def.name}</span>
                  {def.contextWindow != null && (
                    <span className="bg-muted text-muted-foreground shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums">
                      {t('modelLibrary.contextBadge', {
                        value: formatContextWindow(def.contextWindow),
                      })}
                    </span>
                  )}

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

                  <button
                    type="button"
                    onClick={() => setEditing(def)}
                    className="text-muted-foreground hover:text-foreground rounded p-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(def)}
                    className="text-muted-foreground hover:text-destructive rounded p-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </ScrollArea>

      {/* Add dialog */}
      <ModelDefinitionDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        defaultGroup={defaultGroupForAdd}
        onSave={async (data) => {
          await add(data)
          setShowAddDialog(false)
        }}
      />

      {/* Edit dialog */}
      {editing && (
        <ModelDefinitionDialog
          open={!!editing}
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
          initial={editing}
          onSave={async (data) => {
            await update(editing.id, data)
            setEditing(null)
          }}
        />
      )}

      {/* Single-row delete confirm */}
      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('modelLibrary.confirmDelete', { name: deleting?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                if (deleting) {
                  await remove(deleting.id)
                  setDeleting(null)
                }
              }}>
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
