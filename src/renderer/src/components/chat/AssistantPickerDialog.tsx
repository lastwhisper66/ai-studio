import { Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@renderer/components/ui/dialog'
import type { Assistant } from '@shared/types'

interface AssistantPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  assistants: Assistant[]
  onSelect: (assistantId: string) => void
  onCreate?: () => void
}

export function AssistantPickerDialog({
  open,
  onOpenChange,
  assistants,
  onSelect,
  onCreate,
}: AssistantPickerDialogProps): React.JSX.Element {
  const handleSelect = (assistantId: string): void => {
    onSelect(assistantId)
    onOpenChange(false)
  }

  const handleCreate = (): void => {
    onOpenChange(false)
    onCreate?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>选择助手</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {assistants.map((a) => (
            <button
              key={a.id}
              onClick={() => handleSelect(a.id)}
              className="flex items-center gap-2.5 rounded-xl border bg-card/50 px-3 py-3 text-left transition-colors hover:bg-accent">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{a.name}</div>
                {a.description && (
                  <div className="truncate text-xs text-muted-foreground">{a.description}</div>
                )}
              </div>
            </button>
          ))}
          {onCreate && (
            <button
              onClick={handleCreate}
              className="flex items-center gap-2.5 rounded-xl border border-dashed px-3 py-3 text-left text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              <Plus className="h-5 w-5 shrink-0" />
              <span className="text-sm font-medium">新建助手</span>
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
