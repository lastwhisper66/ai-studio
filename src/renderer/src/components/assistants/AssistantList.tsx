import { Plus, Pin } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useAssistantStore } from '@renderer/stores/assistantStore'

export function AssistantList(): React.JSX.Element {
  const { assistants, selectedAssistantId, setSelectedAssistantId, addAssistant } =
    useAssistantStore()

  const handleAdd = async (): Promise<void> => {
    await addAssistant({ name: '新助手' })
  }

  return (
    <div className="flex w-56 shrink-0 flex-col border-r">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-medium">助手列表</span>
        <button
          onClick={handleAdd}
          className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground">
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5">
        {assistants.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
            <p>暂无助手</p>
            <p className="text-xs">点击 + 创建</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {assistants.map((assistant) => {
              const isSelected = selectedAssistantId === assistant.id

              return (
                <button
                  key={assistant.id}
                  onClick={() => setSelectedAssistantId(assistant.id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                    isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
                  )}>
                  <span className="shrink-0 text-base leading-none">{assistant.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 truncate">
                      <span className="truncate">{assistant.name}</span>
                      {assistant.isDefault && (
                        <Pin className="h-3 w-3 shrink-0 rotate-45 text-muted-foreground" />
                      )}
                    </div>
                    {assistant.description && (
                      <div className="truncate text-xs text-muted-foreground">
                        {assistant.description}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
