import { useState } from 'react'
import { Plus, Trash2, Pencil, Pin, Eraser } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@renderer/components/ui/context-menu'
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
    pinConversation,
    setActiveConversation,
    clearMessages,
  } = useConversationStore()

  const activeAssistantId = useAssistantStore((s) => s.activeAssistantId)

  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const [clearId, setClearId] = useState<string | null>(null)

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

  const handleDeleteConfirm = async (): Promise<void> => {
    if (deleteId) {
      const isLastTopic = topicConversations.length === 1 && topicConversations[0].id === deleteId
      if (isLastTopic) {
        await clearMessages(deleteId)
        await renameConversation(deleteId, 'New Chat')
      } else {
        await deleteConversation(deleteId)
      }
    }
    setDeleteDialogOpen(false)
    setDeleteId(null)
  }

  const handleClearOpen = (id: string): void => {
    setClearId(id)
    setClearDialogOpen(true)
  }

  const handleClearConfirm = async (): Promise<void> => {
    if (clearId) {
      await clearMessages(clearId)
      await renameConversation(clearId, 'New Chat')
    }
    setClearDialogOpen(false)
    setClearId(null)
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
            topicConversations.map((conv) => {
              const isActive = activeConversationId === conv.id
              return (
                <ContextMenu key={conv.id}>
                  <ContextMenuTrigger asChild>
                    <div
                      className={`group relative cursor-pointer overflow-hidden rounded-lg px-3 py-2 text-sm ${
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                      }`}
                      onClick={() => setActiveConversation(conv.id)}>
                      <div className="flex items-center gap-1.5">
                        {conv.pinned && <Pin className="h-3 w-3 shrink-0 text-muted-foreground" />}
                        <span className="truncate text-sm">{conv.title}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground/60">
                        {formatTime(conv.updatedAt)}
                      </div>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => handleRenameOpen(conv.id, conv.title)}>
                      <Pencil className="h-4 w-4" />
                      重命名
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => pinConversation(conv.id)}>
                      <Pin className="h-4 w-4" />
                      {conv.pinned ? '取消置顶' : '置顶'}
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => handleClearOpen(conv.id)}>
                      <Eraser className="h-4 w-4" />
                      清空消息
                    </ContextMenuItem>
                    <ContextMenuItem
                      variant="destructive"
                      onClick={() => handleDeleteOpen(conv.id)}>
                      <Trash2 className="h-4 w-4" />
                      删除
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              )
            })
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

      {/* Clear Messages Confirmation Dialog */}
      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>清空消息</DialogTitle>
            <DialogDescription>
              此操作将清除该话题的所有消息记录，话题本身将被保留。无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleClearConfirm}>
              清空
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  )
}
