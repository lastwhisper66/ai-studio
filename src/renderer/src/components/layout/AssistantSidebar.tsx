import { useState, useMemo, useCallback } from 'react'
import { Plus, Pencil, Trash2, Copy, Pin, Library as LibraryIcon, ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { cn } from '@renderer/lib/utils'
import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { SortableItem } from '@renderer/components/ui/sortable-item'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@renderer/components/ui/context-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@renderer/components/ui/dialog'
import { useAssistantStore } from '@renderer/stores/assistantStore'
import { AssistantSettingsDialog } from '@renderer/components/chat/AssistantSettingsDialog'
import { useConversationStore } from '@renderer/stores/conversationStore'
import { useSettingsStore } from '@renderer/stores/settingsStore'

interface AssistantSidebarProps {
  collapsed: boolean
}

interface GroupedAssistants {
  name: string
  assistants: Array<{
    id: string
    name: string
    icon?: string
    description: string
    isDefault: boolean
    sortOrder: number
    group: string
  }>
}

export function AssistantSidebar({ collapsed }: AssistantSidebarProps): React.JSX.Element {
  const { t } = useTranslation()
  const {
    assistants,
    activeAssistantId,
    setActiveAssistantId,
    addAssistant,
    deleteAssistant,
    duplicateAssistant,
    pinAssistant,
    reorderAssistants,
    updateAssistant,
  } = useAssistantStore()
  const { conversations, createConversation, setActiveConversation } = useConversationStore()
  const setActiveView = useSettingsStore((s) => s.setActiveView)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [editAssistantId, setEditAssistantId] = useState<string | null>(null)
  const [createMode, setCreateMode] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const defaultAssistant = assistants.find((a) => a.isDefault)
  const nonDefaultAssistants = assistants.filter((a) => !a.isDefault)

  // Build flat sortable list of non-default assistants (preserving group order)
  const groups = useMemo(() => {
    const grouped = new Map<string, GroupedAssistants>()
    const ungrouped: GroupedAssistants = { name: '', assistants: [] }

    for (const a of nonDefaultAssistants) {
      const groupName = a.group || ''
      if (!groupName) {
        ungrouped.assistants.push(a)
      } else {
        const existing = grouped.get(groupName)
        if (existing) {
          existing.assistants.push(a)
        } else {
          grouped.set(groupName, { name: groupName, assistants: [a] })
        }
      }
    }

    const result: GroupedAssistants[] = [...grouped.values()]
    if (ungrouped.assistants.length > 0) {
      result.push(ungrouped)
    }
    return result
  }, [nonDefaultAssistants])

  // Flat list of all non-default assistant IDs for DnD
  const sortableIds = useMemo(() => nonDefaultAssistants.map((a) => a.id), [nonDefaultAssistants])

  const toggleGroup = (name: string): void => {
    setCollapsedGroups((prev) => ({ ...prev, [name]: !prev[name] }))
  }

  const handleAssistantClick = async (assistantId: string): Promise<void> => {
    setActiveAssistantId(assistantId)
    const existing = conversations.find((c) => c.assistantId === assistantId)
    if (existing) {
      await setActiveConversation(existing.id)
    } else {
      await createConversation(undefined, assistantId)
    }
  }

  const handleAddAssistant = (): void => {
    setCreateMode(true)
    setEditAssistantId(null)
    setSettingsOpen(true)
  }

  const handleCreate = async (
    data: Partial<import('@shared/types').Assistant> & { name: string },
  ): Promise<void> => {
    const assistant = await addAssistant(data)
    if (assistant) {
      setActiveAssistantId(assistant.id)
      await createConversation(undefined, assistant.id)
    }
  }

  const handleSettingsClose = async (open: boolean): Promise<void> => {
    setSettingsOpen(open)
    if (!open) {
      if (!createMode && editAssistantId) {
        const isNew = !conversations.some((c) => c.assistantId === editAssistantId)
        if (isNew) {
          setActiveAssistantId(editAssistantId)
          await createConversation(undefined, editAssistantId)
        }
      }
      setEditAssistantId(null)
      setCreateMode(false)
    }
  }

  const handleEdit = (id: string): void => {
    setEditAssistantId(id)
    setSettingsOpen(true)
  }

  const handleDeleteOpen = (id: string): void => {
    setDeleteId(id)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async (): Promise<void> => {
    if (deleteId) {
      await deleteAssistant(deleteId)
      if (deleteId === activeAssistantId && defaultAssistant) {
        await handleAssistantClick(defaultAssistant.id)
      }
    }
    setDeleteDialogOpen(false)
    setDeleteId(null)
  }

  const isPinned = (a: { sortOrder: number; isDefault: boolean }): boolean =>
    a.sortOrder < 0 && !a.isDefault

  const handleDragStart = (event: DragStartEvent): void => {
    setDraggingId(event.active.id as string)
  }

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDraggingId(null)
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = nonDefaultAssistants.findIndex((a) => a.id === active.id)
      const newIndex = nonDefaultAssistants.findIndex((a) => a.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const draggedAssistant = nonDefaultAssistants[oldIndex]
      const targetAssistant = nonDefaultAssistants[newIndex]

      // Block drags across the pinned/unpinned boundary
      if (isPinned(draggedAssistant) !== isPinned(targetAssistant)) return

      // Build new order: default assistant first, then reordered non-defaults
      const reordered = [...nonDefaultAssistants]
      const [moved] = reordered.splice(oldIndex, 1)
      reordered.splice(newIndex, 0, moved)

      const allIds = [
        ...(defaultAssistant ? [defaultAssistant.id] : []),
        ...reordered.map((a) => a.id),
      ]

      // Cross-group drag: update group first, then reorder
      if (draggedAssistant.group !== targetAssistant.group) {
        const performCrossGroupDrag = async (): Promise<void> => {
          try {
            await updateAssistant(draggedAssistant.id, { group: targetAssistant.group })
            await reorderAssistants(allIds)
          } catch (e) {
            console.error('Cross-group drag failed, rolling back:', e)
            await useAssistantStore.getState().loadAssistants().catch(console.error)
          }
        }
        performCrossGroupDrag().catch(console.error)
      } else {
        reorderAssistants(allIds)
      }
    },
    [nonDefaultAssistants, defaultAssistant, reorderAssistants, updateAssistant],
  )

  const draggingAssistant = draggingId
    ? nonDefaultAssistants.find((a) => a.id === draggingId)
    : null

  return (
    <aside
      className={`relative flex h-full w-64 shrink-0 flex-col border-r bg-sidebar-background text-sidebar-foreground transition-all duration-300${collapsed ? ' !w-0 overflow-hidden' : ''}`}>
      {/* Library shortcut */}
      <div className="mx-2 mt-2 mb-0.5">
        <button
          className="flex h-7 w-full items-center justify-between rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent/40 hover:text-foreground"
          onClick={() => setActiveView('library')}>
          <span className="flex items-center gap-1.5">
            <LibraryIcon className="h-3.5 w-3.5" />
            {t('library.openShortcut')}
          </span>
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      {/* Add Assistant Button */}
      <div className="mx-2 mt-1 mb-1">
        <Button
          variant="ghost"
          className="h-10 w-full justify-start gap-2 rounded-lg text-sm hover:bg-sidebar-accent/40"
          onClick={handleAddAssistant}>
          <Plus className="h-4 w-4" />
          {t('assistant.addAssistant')}
        </Button>
      </div>

      {/* Default Assistant */}
      {defaultAssistant && (
        <div className="px-2 py-0.5">
          <div
            className={cn(
              'flex items-center rounded-lg text-sm transition-colors',
              activeAssistantId === defaultAssistant.id
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'hover:bg-sidebar-accent/40',
            )}>
            <AssistantItem
              assistant={defaultAssistant}
              isPinnedItem={false}
              onClick={() => handleAssistantClick(defaultAssistant.id)}
              onEdit={() => handleEdit(defaultAssistant.id)}
              onDuplicate={() => duplicateAssistant(defaultAssistant.id)}
              onPin={() => {}}
              onDelete={() => {}}
              showPin={false}
              showDelete={false}
            />
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="mx-3 my-1.5 border-b" />

      {/* Grouped Assistants with DnD */}
      <ScrollArea className="flex-1 px-2">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}>
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-2 pb-2">
              {groups.map((group, groupIndex) => {
                const isNamedGroup = Boolean(group.name)
                const isCollapsed = isNamedGroup && Boolean(collapsedGroups[group.name])
                const groupItems = group.assistants.map((a) => (
                  <SortableItem
                    key={a.id}
                    id={a.id}
                    className={cn(
                      'rounded-lg text-left text-sm transition-colors',
                      activeAssistantId === a.id
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'hover:bg-sidebar-accent/40',
                    )}
                    handleClassName="opacity-0 group-hover:opacity-100 transition-opacity">
                    <AssistantItem
                      assistant={a}
                      isPinnedItem={isPinned(a)}
                      onClick={() => handleAssistantClick(a.id)}
                      onEdit={() => handleEdit(a.id)}
                      onDuplicate={() => duplicateAssistant(a.id)}
                      onPin={() => pinAssistant(a.id)}
                      onDelete={() => handleDeleteOpen(a.id)}
                    />
                  </SortableItem>
                ))

                return (
                  <div key={group.name || '__ungrouped__'}>
                    {isNamedGroup && (
                      <button
                        className={cn(
                          'flex w-full items-center gap-2 px-2 py-1 text-left transition-colors hover:text-foreground',
                          groupIndex > 0 && 'mt-2',
                        )}
                        onClick={() => toggleGroup(group.name)}>
                        <span className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/90">
                          {group.name}
                        </span>
                        <span className="ml-auto shrink-0 rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                          {group.assistants.length}
                        </span>
                      </button>
                    )}

                    {(!isNamedGroup || !isCollapsed) &&
                      (isNamedGroup ? (
                        <div className="flex gap-2 pl-2">
                          <div
                            className="ml-0.5 w-px shrink-0 rounded-full bg-border/70"
                            aria-hidden="true"
                          />
                          <div className="flex min-w-0 flex-1 flex-col gap-1">{groupItems}</div>
                        </div>
                      ) : (
                        <div className={cn('flex flex-col gap-0.5', groupIndex > 0 && 'mt-3')}>
                          {groupItems}
                        </div>
                      ))}
                  </div>
                )
              })}
            </div>
          </SortableContext>

          <DragOverlay>
            {draggingAssistant && (
              <div className="rounded-lg bg-sidebar-accent px-3 py-2 text-sm shadow-lg ring-1 ring-primary/30">
                {draggingAssistant.name}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </ScrollArea>

      {/* Assistant Settings Dialog */}
      <AssistantSettingsDialog
        open={settingsOpen}
        onOpenChange={handleSettingsClose}
        assistantId={editAssistantId}
        mode={createMode ? 'create' : 'edit'}
        onCreate={handleCreate}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('assistant.deleteAssistant')}</DialogTitle>
            <DialogDescription>{t('assistant.deleteDescription')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  )
}

// --- Sub-components ---

interface AssistantItemProps {
  assistant: { id: string; name: string; icon?: string; isDefault: boolean; sortOrder: number }
  isPinnedItem: boolean
  onClick: () => void
  onEdit: () => void
  onDuplicate: () => void
  onPin: () => void
  onDelete: () => void
  showPin?: boolean
  showDelete?: boolean
}

function AssistantItem({
  assistant: a,
  isPinnedItem,
  onClick,
  onEdit,
  onDuplicate,
  onPin,
  onDelete,
  showPin = true,
  showDelete = true,
}: AssistantItemProps): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="flex flex-1 cursor-pointer items-center" onClick={onClick}>
          <div className="flex min-w-0 flex-1 items-center px-2 py-2">
            {a.icon && <span className="mr-1.5 shrink-0 text-base leading-none">{a.icon}</span>}
            <span className={cn('min-w-0 truncate text-sm', a.isDefault && 'font-medium')}>
              {a.name}
            </span>
          </div>
          {isPinnedItem && <Pin className="mr-2 h-3 w-3 shrink-0 text-muted-foreground" />}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onEdit}>
          <Pencil className="h-4 w-4" />
          {t('assistant.editAssistant')}
        </ContextMenuItem>
        <ContextMenuItem onClick={onDuplicate}>
          <Copy className="h-4 w-4" />
          {t('assistant.duplicateAssistant')}
        </ContextMenuItem>
        {showPin && (
          <ContextMenuItem onClick={onPin}>
            <Pin className="h-4 w-4" />
            {isPinnedItem ? t('common.unpin') : t('common.pin')}
          </ContextMenuItem>
        )}
        {showDelete && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
              {t('common.delete')}
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
