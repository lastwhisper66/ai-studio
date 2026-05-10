import { useTranslation } from 'react-i18next'
import { cn } from '@renderer/lib/utils'

interface CategoryCount {
  id: string
  count: number
}

interface CategorySidebarProps {
  categories: CategoryCount[]
  totalCount: number
  activeCategory: string | null
  onSelect: (category: string | null) => void
}

export function CategorySidebar({
  categories,
  totalCount,
  activeCategory,
  onSelect,
}: CategorySidebarProps): React.JSX.Element {
  const { t } = useTranslation()

  const renderEntry = (id: string | null, label: string, count: number): React.JSX.Element => (
    <button
      key={id ?? '__all__'}
      onClick={() => onSelect(id)}
      className={cn(
        'flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
        activeCategory === id
          ? 'bg-accent text-accent-foreground font-medium'
          : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground',
      )}>
      <span className="truncate">{label}</span>
      <span className="ml-2 shrink-0 rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
        {count}
      </span>
    </button>
  )

  return (
    <aside className="flex h-full w-[130px] shrink-0 flex-col border-r p-2">
      {renderEntry(null, t('library.categories.all'), totalCount)}
      <div className="mt-2 space-y-0.5">
        {categories.map((c) =>
          renderEntry(c.id, t(`library.categories.${c.id}`, { defaultValue: c.id }), c.count),
        )}
      </div>
    </aside>
  )
}
