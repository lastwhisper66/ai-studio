import { useTranslation } from 'react-i18next'
import { cn } from '@renderer/lib/utils'
import type { QuickAction } from '@shared/types'
import { useSeedTranslator } from '@renderer/hooks/useSeedTranslator'
import { quickActionIconMap, defaultQuickActionIcon } from './icons'

interface ActionListProps {
  actions: QuickAction[]
  selectedIndex: number
  onSelect: (index: number) => void
  onExecute: (action: QuickAction) => void
}

export function ActionList({
  actions,
  selectedIndex,
  onSelect,
  onExecute,
}: ActionListProps): React.JSX.Element {
  const { t } = useTranslation()
  const st = useSeedTranslator()

  return (
    <div className="flex flex-col gap-1 p-2">
      {actions.map((action, index) => {
        const Icon = quickActionIconMap[action.icon] || defaultQuickActionIcon
        const name = st(action.name)
        const description = st(action.description)
        return (
          <button
            key={action.id}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
              index === selectedIndex
                ? 'bg-primary/10 text-primary'
                : 'text-foreground hover:bg-muted',
            )}
            onMouseEnter={() => onSelect(index)}
            onClick={() => onExecute(action)}>
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                index === selectedIndex ? 'bg-primary/20' : 'bg-muted',
              )}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{name}</p>
              {description && (
                <p className="text-muted-foreground truncate text-xs">{description}</p>
              )}
            </div>
          </button>
        )
      })}
      {actions.length === 0 && (
        <div className="py-6 text-center">
          <p className="text-muted-foreground text-sm">{t('settings.quickAssistant.noActions')}</p>
        </div>
      )}
    </div>
  )
}
