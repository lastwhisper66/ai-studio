import { useState, useEffect, useMemo } from 'react'
import { Plus, Search, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { cn } from '@renderer/lib/utils'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Input } from '@renderer/components/ui/input'
import { SortableItem } from '@renderer/components/ui/sortable-item'
import { useSkillStore } from '@renderer/stores/skillStore'
import { AddSkillDialog } from './AddSkillDialog'

export function SkillList(): React.JSX.Element {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const { skills, selectedSkillId, setSelectedSkillId, updateSkill, reorderSkills, loadSkills } =
    useSkillStore()

  useEffect(() => {
    loadSkills()
  }, [loadSkills])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const draggingSkill = useMemo(() => {
    return draggingId ? skills.find((s) => s.id === draggingId) : null
  }, [draggingId, skills])

  useEffect(() => {
    return () => setDraggingId(null)
  }, [])

  const handleToggle = async (e: React.MouseEvent, id: string, enabled: boolean): Promise<void> => {
    e.stopPropagation()
    await updateSkill(id, { enabled: !enabled })
  }

  const isSearching = search.trim().length > 0
  const filtered = isSearching
    ? skills.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    : skills

  const handleDragStart = (event: DragStartEvent): void => {
    setDraggingId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent): void => {
    setDraggingId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = skills.findIndex((s) => s.id === active.id)
    const newIndex = skills.findIndex((s) => s.id === over.id)
    const reordered = arrayMove(skills, oldIndex, newIndex)
    reorderSkills(reordered.map((s) => s.id))
  }

  return (
    <div className="flex w-64 shrink-0 flex-col border-r">
      <div className="border-b p-2.5">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('settings.skill.searchPlaceholder')}
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-1">
          {filtered.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-center text-sm">
              <p>
                {skills.length === 0
                  ? t('settings.skill.noSkills')
                  : t('settings.skill.noSearchResults')}
              </p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}>
              <SortableContext
                items={filtered.map((s) => s.id)}
                strategy={verticalListSortingStrategy}>
                <div className="space-y-0.5">
                  {filtered.map((skill) => {
                    const isSelected = selectedSkillId === skill.id
                    return (
                      <SortableItem
                        key={skill.id}
                        id={skill.id}
                        disabled={isSearching}
                        className={cn(
                          'rounded-lg text-left text-sm transition-colors',
                          isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
                        )}
                        handleClassName="pl-0.5 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setSelectedSkillId(skill.id)}
                          className="flex min-w-0 flex-1 items-center gap-2 px-1.5 py-1.5 text-left">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                            <Sparkles className="h-4 w-4" />
                          </div>
                          <span className="min-w-0 flex-1 truncate">{skill.name}</span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={skill.enabled}
                            onClick={(e) => handleToggle(e, skill.id, skill.enabled)}
                            className={cn(
                              'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors',
                              skill.enabled
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                : 'bg-muted text-muted-foreground',
                            )}>
                            {skill.enabled ? 'ON' : 'OFF'}
                          </button>
                        </button>
                      </SortableItem>
                    )
                  })}
                </div>
              </SortableContext>
              <DragOverlay>
                {draggingSkill && (
                  <div className="flex items-center gap-2.5 rounded-lg bg-accent px-3 py-2 text-sm shadow-lg ring-1 ring-primary/30">
                    <Sparkles className="h-4 w-4" />
                    <span className="truncate">{draggingSkill.name}</span>
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      </ScrollArea>

      <div className="border-t p-2.5">
        <AddSkillDialog>
          <button className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary">
            <Plus className="h-4 w-4" />
            {t('common.add')}
          </button>
        </AddSkillDialog>
      </div>
    </div>
  )
}
