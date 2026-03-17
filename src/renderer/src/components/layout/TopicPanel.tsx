import { useState } from 'react'
import { Plus, Trash2, Pencil } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { useConversationStore } from '@renderer/stores/conversationStore'
import { useAssistantStore } from '@renderer/stores/assistantStore'

interface TopicPanelProps {
  collapsed: boolean
}

export function TopicPanel({ collapsed }: TopicPanelProps): React.JSX.Element {
  const {
    conversations,
    activeConversationId,
    createConversation,
    deleteConversation,
    renameConversation,
    setActiveConversation,
  } = useConversationStore()

  const activeAssistantId = useAssistantStore((s) => s.activeAssistantId)

  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Filter conversations by active assistant
  const topicConversations = conversations.filter((c) => c.assistantId === activeAssistantId)

  const handleNewTopic = async (): Promise<void> => {
    if (!activeAssistantId) return
    await createConversation(undefined, activeAssistantId)
  }

  const handleRenameOpen = (id: string, currentTitle: string): void => {
    setRenameId(id)
    setRenameValue(currentTitle)
    setRenameDialogOpen(true)
  }

  const handleRenameConfirm = (): void => {
    if (renameId && renameValue.trim()) {
      renameConversation(renameId, renameValue.trim())
    }
    setRenameDialogOpen(false)
    setRenameId(null)
  }

  const handleDeleteOpen = (id: string): void => {
    setDeleteId(id)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = (): void => {
    if (deleteId) {
      deleteConversation(deleteId)
    }
    setDeleteDialogOpen(false)
    setDeleteId(null)
  }

  const formatTime = (iso: string): string => {
    try {
      const d = new Date(iso)
      const now = new Date()
      const sameDay =
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()

      if (sameDay) {
        return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      }
      return d.toLocaleDateString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return ''
    }
  }

  return (
    <aside
      className={`flex h-full flex-col border-l bg-sidebar-background text-sidebar-foreground transition-all duration-300 ${
        collapsed ? 'w-0 overflow-hidden' : 'w-56'
      }`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="text-sm font-semibold">话题</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNewTopic}>
              <Plus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">新建话题</TooltipContent>
        </Tooltip>
      </div>

      {/* Divider */}
      <div className="mx-3 border-b" />

      {/* Topic list */}
      <ScrollArea className="flex-1 px-2 pt-1">
        <div className="space-y-0.5 pb-2">
          {topicConversations.length === 0 ? (
            <div className="px-2 py-4 text-center text-xs text-muted-foreground">
              暂无话题，点击上方按钮创建
            </div>
          ) : (
            topicConversations.map((conv) => (
              <div
                key={conv.id}
                className={`group flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm ${
                  activeConversationId === conv.id
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                }`}
                onClick={() => setActiveConversation(conv.id)}>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{conv.title}</div>
                  <div className="text-[11px] text-muted-foreground/60">
                    {formatTime(conv.updatedAt)}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRenameOpen(conv.id, conv.title)
                    }}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteOpen(conv.id)
                    }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名话题</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameConfirm()
            }}
            placeholder="话题标题"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleRenameConfirm}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除话题</DialogTitle>
            <DialogDescription>此操作将永久删除该话题及其所有消息，无法撤销。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  )
}
