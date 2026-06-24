import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Trash2, Layers, AlertCircle, Search } from 'lucide-react'
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
import { Input } from '@renderer/components/ui/input'
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

interface GroupNode {
  /** Stable identifier across rule rows and virtual nodes. */
  displayName: string
  /** Backing `model_groups` row, if any. Virtual nodes (catalog `def.group`
   *  that has no matching rule row) leave this undefined; they are not
   *  draggable / editable / deletable. */
  rule: ModelGroup | undefined
  count: number
}

export function GroupRulesPanel({
  selection,
  onSelectionChange,
}: GroupRulesPanelProps): React.JSX.Element {
  const { t } = useTranslation()
  const { groups, add, update, remove, reorder } = useModelGroupStore()
  const { definitions } = useModelDefinitionStore()
  const resolveDefinitionGroup = useModelGroupStore((s) => s.resolveDefinitionGroup)

  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editing, setEditing] = useState<ModelGroup | null>(null)
  const [deleting, setDeleting] = useState<ModelGroup | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const countByDisplayName = useMemo(() => {
    const map = new Map<string, number>()
    for (const def of definitions) {
      const name = resolveDefinitionGroup(def)
      if (name) map.set(name, (map.get(name) ?? 0) + 1)
    }
    return map
  }, [definitions, resolveDefinitionGroup])

  const unmatchedCount = useMemo(() => {
    let n = 0
    for (const def of definitions) {
      if (!resolveDefinitionGroup(def)) n += 1
    }
    return n
  }, [definitions, resolveDefinitionGroup])

  /**
   * Compose the visible node list. Two sources are merged:
   *   - `model_groups` rows (catalog-synced + user-defined)
   *   - distinct `def.group` values that have no matching rule row
   *     (rendered as read-only "virtual" nodes)
   *
   * Sort order: rule rows by their `sortOrder`, then virtual nodes by
   * displayName. The rule-row order is what gets persisted by dnd reorder.
   */
  const nodes = useMemo<GroupNode[]>(() => {
    const ruleNodes: GroupNode[] = groups.map((g) => ({
      displayName: g.displayName,
      rule: g,
      count: countByDisplayName.get(g.displayName) ?? 0,
    }))
    const ruleNameSet = new Set(groups.map((g) => g.displayName))
    const virtualNames = new Set<string>()
    for (const name of countByDisplayName.keys()) {
      if (!ruleNameSet.has(name)) virtualNames.add(name)
    }
    const virtualNodes: GroupNode[] = [...virtualNames]
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({
        displayName: name,
        rule: undefined,
        count: countByDisplayName.get(name) ?? 0,
      }))
    return [...ruleNodes, ...virtualNodes]
  }, [groups, countByDisplayName])

  const filteredNodes = useMemo<GroupNode[]>(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return nodes
    return nodes.filter((n) => n.displayName.toLowerCase().includes(q))
  }, [nodes, searchQuery])

  const impactedCount = useMemo(() => {
    if (!deleting) return 0
    return countByDisplayName.get(deleting.displayName) ?? 0
  }, [deleting, countByDisplayName])

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

          {/* Search groups */}
          <div className="relative px-1 pb-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('modelManage.searchGroupPlaceholder')}
              className="h-7 pl-8 text-xs"
            />
          </div>

          {/* Sortable rule list */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}>
            <SortableContext
              items={filteredNodes.filter((n) => n.rule).map((n) => n.rule!.id)}
              strategy={verticalListSortingStrategy}>
              {filteredNodes.map((node) => {
                const isSelected =
                  selection.kind === 'group' && selection.displayName === node.displayName
                const itemId = node.rule?.id ?? `__virtual__:${node.displayName}`
                const isDraggable = node.rule !== undefined
                return (
                  <SortableItem
                    key={itemId}
                    id={itemId}
                    disabled={!isDraggable}
                    className={`group rounded-md text-sm transition-colors ${
                      isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                    }`}
                    handleClassName="pl-0.5 py-1.5 opacity-0 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() =>
                        onSelectionChange({ kind: 'group', displayName: node.displayName })
                      }
                      className="flex min-w-0 flex-1 items-center gap-2 px-1.5 py-1.5 text-left">
                      <span className="flex-1 truncate">{node.displayName}</span>
                      <span className="text-muted-foreground text-xs">({node.count})</span>
                    </button>
                    {node.rule && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditing(node.rule!)
                          }}
                          className="text-muted-foreground hover:text-foreground rounded p-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleting(node.rule!)
                          }}
                          className="text-muted-foreground hover:text-destructive rounded p-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </>
                    )}
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
                  if (
                    selection.kind === 'group' &&
                    selection.displayName === deleting.displayName
                  ) {
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
