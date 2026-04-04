import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

interface SortableItemProps {
  id: string
  children: React.ReactNode
  className?: string
  handleClassName?: string
  disabled?: boolean
}

export function SortableItem({
  id,
  children,
  className,
  handleClassName,
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
      className={cn(
        'group flex items-center',
        isDragging && 'z-50 rounded-lg opacity-50 shadow-lg ring-1 ring-primary/30',
        className,
      )}>
      {!disabled && (
        <div
          {...attributes}
          {...listeners}
          className={cn(
            'flex shrink-0 cursor-grab touch-none items-center text-muted-foreground transition-colors hover:text-foreground active:cursor-grabbing',
            handleClassName,
          )}>
          <GripVertical className="h-4 w-4" />
        </div>
      )}
      {children}
    </div>
  )
}
