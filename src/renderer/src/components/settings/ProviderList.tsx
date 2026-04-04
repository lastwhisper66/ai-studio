import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
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
import { cn } from '@renderer/lib/utils'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Input } from '@renderer/components/ui/input'
import { SortableItem } from '@renderer/components/ui/sortable-item'
import { useProviderStore } from '@renderer/stores/providerStore'
import { getTemplateByType } from './provider-templates'
import { AddProviderDialog } from './AddProviderDialog'

function ProviderAvatar({ name, color }: { name: string; color: string }): React.JSX.Element {
  const letter = name.charAt(0).toUpperCase()
  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
      style={{ backgroundColor: color }}>
      {letter}
    </span>
  )
}

export function ProviderList(): React.JSX.Element {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const { providers, selectedProviderId, setSelectedProviderId, updateProvider, reorderProviders } =
    useProviderStore()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleToggle = async (e: React.MouseEvent, id: string, enabled: boolean): Promise<void> => {
    e.stopPropagation()
    await updateProvider(id, { enabled: !enabled })
  }

  const isSearching = search.trim().length > 0
  const filtered = isSearching
    ? providers.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : providers

  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = providers.findIndex((p) => p.id === active.id)
    const newIndex = providers.findIndex((p) => p.id === over.id)
    const reordered = arrayMove(providers, oldIndex, newIndex)
    reorderProviders(reordered.map((p) => p.id))
  }

  return (
    <div className="flex w-64 shrink-0 flex-col border-r">
      {/* Search */}
      <div className="border-b p-2.5">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('settings.provider.searchPlaceholder')}
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>

      {/* Provider list */}
      <ScrollArea className="flex-1">
        <div className="p-1.5">
          {filtered.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-center text-sm">
              <p>
                {providers.length === 0
                  ? t('settings.provider.noProviders')
                  : t('settings.provider.noSearchResults')}
              </p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}>
              <SortableContext
                items={filtered.map((p) => p.id)}
                strategy={verticalListSortingStrategy}>
                <div className="space-y-0.5">
                  {filtered.map((provider) => {
                    const template = getTemplateByType(provider.type)
                    const isSelected = selectedProviderId === provider.id
                    const color = template?.color ?? '#6b7280'

                    return (
                      <SortableItem
                        key={provider.id}
                        id={provider.id}
                        disabled={isSearching}
                        className={cn(
                          'rounded-lg text-left text-sm transition-colors',
                          isSelected
                            ? 'bg-accent text-accent-foreground'
                            : 'hover:bg-accent/50',
                        )}
                        handleClassName="pl-1 py-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setSelectedProviderId(provider.id)}
                          className="group flex min-w-0 flex-1 items-center gap-2.5 px-2 py-2">
                          <ProviderAvatar name={provider.name} color={color} />
                          <span className="min-w-0 flex-1 truncate">{provider.name}</span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={provider.enabled}
                            onClick={(e) => handleToggle(e, provider.id, provider.enabled)}
                            className={cn(
                              'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors',
                              provider.enabled
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                : 'bg-muted text-muted-foreground',
                            )}>
                            {provider.enabled ? 'ON' : 'OFF'}
                          </button>
                        </button>
                      </SortableItem>
                    )
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </ScrollArea>

      {/* Add button */}
      <div className="border-t p-2.5">
        <AddProviderDialog>
          <button className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary">
            <Plus className="h-4 w-4" />
            {t('common.add')}
          </button>
        </AddProviderDialog>
      </div>
    </div>
  )
}
