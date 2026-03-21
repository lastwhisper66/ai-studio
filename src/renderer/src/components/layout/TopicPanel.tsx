import { useState } from 'react'
import { Plus, Trash2, Pencil, Pin, Eraser } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
        return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
      }
      return d.toLocaleDateString(undefined, {
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
        <span className="text-sm font-semibold">{t('topic.title')}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNewTopic}>
              <Plus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">{t('topic.newTopic')}</TooltipContent>
        </Tooltip>
      </div>

      {/* Divider */}
      <div className="mx-3 border-b" />

      {/* Topic list */}
      <ScrollArea className="flex-1 px-2 pt-1">
        <div className="space-y-0.5 pb-2">
          {topicConversations.length === 0 ? (
            <div className="px-2 py-4 text-center text-xs text-muted-foreground">
              {t('topic.noTopics')}
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
                      {t('topic.rename')}
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => pinConversation(conv.id)}>
                      <Pin className="h-4 w-4" />
                      {conv.pinned ? t('common.unpin') : t('common.pin')}
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => handleClearOpen(conv.id)}>
                      <Eraser className="h-4 w-4" />
                      {t('topic.clearMessages')}
                    </ContextMenuItem>
                    <ContextMenuItem
                      variant="destructive"
                      onClick={() => handleDeleteOpen(conv.id)}>
                      <Trash2 className="h-4 w-4" />
                      {t('common.delete')}
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
            <DialogTitle>{t('topic.renameTitle')}</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameConfirm()
            }}
            placeholder={t('topic.topicTitlePlaceholder')}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleRenameConfirm}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('topic.deleteTitle')}</DialogTitle>
            <DialogDescription>{t('topic.deleteDescription')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear Messages Confirmation Dialog */}
      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('topic.clearTitle')}</DialogTitle>
            <DialogDescription>{t('topic.clearDescription')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleClearConfirm}>
              {t('topic.clearButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  )
}
