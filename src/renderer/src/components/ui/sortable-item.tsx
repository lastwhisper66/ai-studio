import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

interface SortableItemProps {
  id: string
  children: React.ReactNode
  className?: string
  handleClassName?: string
  handleIconSize?: string
  disabled?: boolean
}

export function SortableItem({
  id,
  children,
  className,
  handleClassName,
  handleIconSize = 'h-4 w-4',
  disabled,
}: SortableItemProps): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(disabled ? {} : { ...attributes, ...listeners })}
      className={cn(
        'group flex items-center',
        !disabled && 'cursor-grab active:cursor-grabbing',
        isDragging && 'z-50 rounded-lg opacity-50 shadow-lg ring-1 ring-primary/30',
        className,
      )}>
      {!disabled && (
        <div
          className={cn(
            'flex shrink-0 touch-none items-center text-muted-foreground transition-colors hover:text-foreground',
            handleClassName,
          )}>
          <GripVertical className={handleIconSize} />
        </div>
      )}
      {children}
    </div>
  )
}
