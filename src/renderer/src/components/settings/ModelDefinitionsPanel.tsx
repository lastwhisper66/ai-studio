import { useState, useMemo, forwardRef, useImperativeHandle, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Button } from '@renderer/components/ui/button'
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
import { CAPABILITY_CONFIG } from './capability-config'
import type { ModelDefinition } from '@shared/types'
import { type GroupSelection } from './group-selection'

export interface ModelDefinitionsPanelHandle {
  /** Scroll a definition row into view and flash a highlight ring. */
  highlightDefinition: (id: string) => void
}

export interface ModelDefinitionsPanelProps {
  selection: GroupSelection
}

export const ModelDefinitionsPanel = forwardRef<
  ModelDefinitionsPanelHandle,
  ModelDefinitionsPanelProps
>(function ModelDefinitionsPanel({ selection }, ref): React.JSX.Element {
  const { t } = useTranslation()
  const { definitions, add, update, remove } = useModelDefinitionStore()
  const resolveRule = useModelGroupStore((s) => s.resolveRule)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editing, setEditing] = useState<ModelDefinition | null>(null)
  const [deleting, setDeleting] = useState<ModelDefinition | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  useImperativeHandle(ref, () => ({
    highlightDefinition: (id: string) => {
      setHighlightId(id)
      const el = rowRefs.current.get(id)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    },
  }))

  useEffect(() => {
    if (!highlightId) return
    const tid = setTimeout(() => setHighlightId(null), 1500)
    return () => clearTimeout(tid)
  }, [highlightId])

  // Clear selection when the left-pane filter changes.
  useEffect(() => {
    setSelectedIds(new Set())
  }, [selection])

  const filtered = useMemo(() => {
    if (selection.kind === 'all') return definitions
    if (selection.kind === 'unmatched') {
      return definitions.filter((d) => !resolveRule(d.name))
    }
    return definitions.filter((d) => resolveRule(d.name)?.id === selection.group.id)
  }, [definitions, selection, resolveRule])

  const groupPatternHint = selection.kind === 'rule' ? selection.group.pattern : undefined
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
      {/* Header row */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Select all" />
        <span className="text-muted-foreground text-xs">
          {selectedIds.size} / {filtered.length}
        </span>
        <div className="ml-auto">
          <Button size="sm" onClick={() => setShowAddDialog(true)} className="h-7 gap-1 text-xs">
            <Plus className="h-3 w-3" />
            {t('modelLibrary.addDefinition')}
          </Button>
        </div>
      </div>

      {/* Batch toolbar (always visible; buttons disabled when nothing selected) */}
      <div className="border-b px-3 py-2">
        <BatchToolbar
          selected={selectedDefs}
          onUpdateCapabilities={(id, caps) => update(id, { capabilities: caps })}
          onUpdateProviderTypes={(id, pts) => update(id, { providerTypes: pts })}
          onDelete={(id) => remove(id)}
          onBatchDone={() => setSelectedIds(new Set())}
        />
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {filtered.length === 0 ? (
            <div className="text-muted-foreground py-12 text-center text-sm">
              {definitions.length === 0 ? t('modelLibrary.empty') : t('modelLibrary.noResults')}
            </div>
          ) : (
            <div className="space-y-0.5">
              {filtered.map((def) => {
                const isSelected = selectedIds.has(def.id)
                const isHighlighted = highlightId === def.id
                return (
                  <div
                    key={def.id}
                    ref={(el) => {
                      if (el) rowRefs.current.set(def.id, el)
                      else rowRefs.current.delete(def.id)
                    }}
                    className={`group flex items-center gap-2 rounded-md border-l-2 px-2 py-1.5 transition-colors ${
                      isSelected
                        ? 'bg-accent/50 border-primary'
                        : 'border-transparent hover:bg-accent/30'
                    } ${isHighlighted ? 'ring-2 ring-primary/60' : ''}`}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleOne(def.id)}
                      aria-label={`Select ${def.name}`}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm">{def.name}</span>

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
        </div>
      </ScrollArea>

      {/* Add dialog */}
      <ModelDefinitionDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        groupPatternHint={groupPatternHint}
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
})
