import { useTranslation } from 'react-i18next'
import { Plus, Download, Search } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'

export type LibraryTab = 'discover' | 'mine'

interface LibraryToolbarProps {
  activeTab: LibraryTab
  onTabChange: (tab: LibraryTab) => void
  templateCount: number
  assistantCount: number
  searchQuery: string
  onSearchChange: (q: string) => void
  onNewTemplate: () => void
  onImport: () => void
}

export function LibraryToolbar({
  activeTab,
  onTabChange,
  templateCount,
  assistantCount,
  searchQuery,
  onSearchChange,
  onNewTemplate,
  onImport,
}: LibraryToolbarProps): React.JSX.Element {
  const { t } = useTranslation()

  const tabBtn = (id: LibraryTab, label: string, count: number): React.JSX.Element => (
    <button
      key={id}
      onClick={() => onTabChange(id)}
      className={cn(
        'rounded-md px-3 py-1.5 text-sm transition-colors',
        activeTab === id
          ? 'bg-accent text-accent-foreground font-medium'
          : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground',
      )}>
      {label} ({count})
    </button>
  )

  return (
    <div className="space-y-3 border-b p-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {tabBtn('discover', t('library.tabs.discover'), templateCount)}
          {tabBtn('mine', t('library.tabs.myAssistants'), assistantCount)}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onImport}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            {t('library.toolbar.import')}
          </Button>
          <Button size="sm" onClick={onNewTemplate}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {t('library.toolbar.newTemplate')}
          </Button>
        </div>
      </div>
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('library.search.placeholder')}
          className="pl-8 h-8 text-sm"
        />
      </div>
    </div>
  )
}
