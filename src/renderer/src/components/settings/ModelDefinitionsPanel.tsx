import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
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

  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editing, setEditing] = useState<ModelDefinition | null>(null)
  const [deleting, setDeleting] = useState<ModelDefinition | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

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

  return (
    <div className="flex flex-1 flex-col">
      <CatalogSyncBanner />
      {/* Header row: search + Add Model */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <div className="relative w-56">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('modelLibrary.searchPlaceholder')}
            className="h-7 pl-7 text-xs"
          />
        </div>
        <Button
          size="sm"
          onClick={() => setShowAddDialog(true)}
          className="ml-auto h-7 gap-1 text-xs">
          <Plus className="h-3 w-3" />
          {t('modelLibrary.addDefinition')}
        </Button>
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
              return (
                <div
                  key={def.id}
                  className="group flex items-center gap-2 px-3 py-2 transition-colors hover:bg-accent/30">
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
