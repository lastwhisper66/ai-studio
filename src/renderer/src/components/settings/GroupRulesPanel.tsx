import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Trash2, Layers, AlertCircle } from 'lucide-react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Button } from '@renderer/components/ui/button'
import { SortableItem } from '@renderer/components/ui/sortable-item'
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
import { useModelGroupStore } from '@renderer/stores/modelGroupStore'
import { useModelDefinitionStore } from '@renderer/stores/modelDefinitionStore'
import { ModelGroupDialog } from './ModelGroupDialog'
import type { ModelGroup } from '@shared/types'
import { type GroupSelection, SEL_ALL, SEL_UNMATCHED, isSameSelection } from './group-selection'

export interface GroupRulesPanelProps {
  selection: GroupSelection
  onSelectionChange: (sel: GroupSelection) => void
}

export function GroupRulesPanel({
  selection,
  onSelectionChange,
}: GroupRulesPanelProps): React.JSX.Element {
  const { t } = useTranslation()
  const { groups, add, update, remove, reorder } = useModelGroupStore()
  const { definitions } = useModelDefinitionStore()
  const resolveRule = useModelGroupStore((s) => s.resolveRule)

  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editing, setEditing] = useState<ModelGroup | null>(null)
  const [deleting, setDeleting] = useState<ModelGroup | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const countByGroupId = useMemo(() => {
    const map = new Map<string, number>()
    for (const def of definitions) {
      const r = resolveRule(def.name)
      if (r) map.set(r.id, (map.get(r.id) ?? 0) + 1)
    }
    return map
  }, [definitions, resolveRule])

  const unmatchedCount = useMemo(() => {
    let n = 0
    for (const def of definitions) {
      if (!resolveRule(def.name)) n += 1
    }
    return n
  }, [definitions, resolveRule])

  const impactedCount = useMemo(() => {
    if (!deleting) return 0
    return countByGroupId.get(deleting.id) ?? 0
  }, [deleting, countByGroupId])

  const handleDragEnd = async (event: DragEndEvent): Promise<void> => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = groups.findIndex((g) => g.id === active.id)
    const newIndex = groups.findIndex((g) => g.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const reordered = arrayMove(groups, oldIndex, newIndex)
    await reorder(reordered.map((g) => g.id))
  }

  return (
    <nav className="flex w-64 shrink-0 flex-col border-r">
      <ScrollArea className="flex-1">
        <div className="space-y-0.5 p-2">
          {/* Pseudo-node: All Models */}
          <button
            type="button"
            onClick={() => onSelectionChange(SEL_ALL)}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
              isSameSelection(selection, SEL_ALL)
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent/50'
            }`}>
            <Layers className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="flex-1">{t('modelManage.allModels')}</span>
            <span className="text-muted-foreground text-xs">({definitions.length})</span>
          </button>

          {/* Pseudo-node: Unmatched Models */}
          <button
            type="button"
            onClick={() => onSelectionChange(SEL_UNMATCHED)}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
              isSameSelection(selection, SEL_UNMATCHED)
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent/50'
            }`}>
            <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="flex-1">{t('modelManage.unmatched')}</span>
            <span className="text-muted-foreground text-xs">({unmatchedCount})</span>
          </button>

          <div className="my-1 border-t" />

          {/* Sortable rule list */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}>
            <SortableContext items={groups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
              {groups.map((group) => {
                const isSelected = selection.kind === 'rule' && selection.group.id === group.id
                return (
                  <SortableItem
                    key={group.id}
                    id={group.id}
                    className={`group rounded-md text-sm transition-colors ${
                      isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                    }`}
                    handleClassName="pl-0.5 py-1.5 opacity-0 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => onSelectionChange({ kind: 'rule', group })}
                      className="flex min-w-0 flex-1 items-center gap-2 px-1.5 py-1.5 text-left">
                      <span className="flex-1 truncate">{group.displayName}</span>
                      <span className="text-muted-foreground text-xs">
                        ({countByGroupId.get(group.id) ?? 0})
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditing(group)
                      }}
                      className="text-muted-foreground hover:text-foreground rounded p-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleting(group)
                      }}
                      className="text-muted-foreground hover:text-destructive rounded p-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </SortableItem>
                )
              })}
            </SortableContext>
          </DndContext>
        </div>
      </ScrollArea>

      <div className="border-t p-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowAddDialog(true)}
          className="w-full justify-start gap-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" />
          {t('modelManage.newGroup')}
        </Button>
      </div>

      <ModelGroupDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSave={async (data) => {
          await add(data)
          setShowAddDialog(false)
        }}
      />

      {editing && (
        <ModelGroupDialog
          open={!!editing}
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
          initialData={editing}
          onSave={async (data) => {
            await update(editing.id, data)
            setEditing(null)
          }}
        />
      )}

      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('modelGroup.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('modelGroup.deleteDescription', { name: deleting?.displayName })}
              {impactedCount > 0 && (
                <>
                  <br />
                  {t('modelManage.deleteRuleImpact', { count: impactedCount })}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                if (deleting) {
                  await remove(deleting.id)
                  if (selection.kind === 'rule' && selection.group.id === deleting.id) {
                    onSelectionChange(SEL_ALL)
                  }
                  setDeleting(null)
                }
              }}>
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </nav>
  )
}
