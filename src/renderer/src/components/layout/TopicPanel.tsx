import { useState } from 'react'
import { Plus, Trash2, Pencil, Pin, Eraser, CheckSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { Checkbox } from '@renderer/components/ui/checkbox'
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
    isStreaming,
    createConversation,
    deleteConversation,
    deleteConversations,
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

  // Multi-select state
  const [isMultiSelect, setIsMultiSelect] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteManyDialogOpen, setDeleteManyDialogOpen] = useState(false)

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
      await deleteConversation(deleteId)
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

  // Multi-select handlers
  const handleToggleMultiSelect = (): void => {
    setIsMultiSelect((prev) => !prev)
    setSelectedIds(new Set())
  }

  const handleToggleSelect = (id: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSelectAll = (): void => {
    if (selectedIds.size === topicConversations.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(topicConversations.map((c) => c.id)))
    }
  }

  const handleDeleteMany = (): void => {
    if (selectedIds.size === 0) return
    setDeleteManyDialogOpen(true)
  }

  const handleDeleteManyConfirm = async (): Promise<void> => {
    const ids = Array.from(selectedIds)
    if (ids.length > 0) {
      await deleteConversations(ids)
    }

    setDeleteManyDialogOpen(false)
    setSelectedIds(new Set())
    setIsMultiSelect(false)
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
      className={`relative flex h-full w-56 shrink-0 flex-col border-l bg-sidebar-background text-sidebar-foreground transition-all duration-300${collapsed ? ' !w-0 overflow-hidden' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-2 pt-2 pb-1">
        <Button
          variant="ghost"
          className="h-10 flex-1 justify-start gap-2 rounded-xl text-sm hover:bg-sidebar-accent/40"
          onClick={handleNewTopic}>
          <Plus className="h-4 w-4" />
          {t('topic.newTopic')}
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`h-10 w-10 rounded-xl ${
                isMultiSelect ? 'bg-sidebar-accent text-sidebar-accent-foreground' : ''
              }`}
              onClick={handleToggleMultiSelect}>
              <CheckSquare className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">{t('topic.multiSelect')}</TooltipContent>
        </Tooltip>
      </div>

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
              const isSelected = selectedIds.has(conv.id)
              return (
                <ContextMenu key={conv.id}>
                  <ContextMenuTrigger asChild>
                    <div
                      className={`group relative cursor-pointer overflow-hidden rounded-lg px-3 py-2 text-sm ${
                        isActive && !isMultiSelect
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : isSelected
                            ? 'bg-sidebar-accent/60 text-sidebar-accent-foreground'
                            : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                      }`}
                      onClick={() => {
                        if (isMultiSelect) {
                          handleToggleSelect(conv.id)
                        } else {
                          setActiveConversation(conv.id)
                        }
                      }}>
                      <div className="flex items-center gap-1.5">
                        {isMultiSelect && (
                          <Checkbox
                            checked={isSelected}
                            className="h-3.5 w-3.5 shrink-0"
                            onCheckedChange={() => handleToggleSelect(conv.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                        {conv.pinned && !isMultiSelect && (
                          <Pin className="h-3 w-3 shrink-0 opacity-60" />
                        )}
                        <span className="flex-1 truncate">{conv.title}</span>
                      </div>
                      <div className="mt-0.5 text-xs opacity-50">{formatTime(conv.updatedAt)}</div>
                    </div>
                  </ContextMenuTrigger>
                  {!isMultiSelect && (
                    <ContextMenuContent>
                      <ContextMenuItem onClick={() => handleRenameOpen(conv.id, conv.title)}>
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        {t('topic.rename')}
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => pinConversation(conv.id)}>
                        <Pin className="mr-2 h-3.5 w-3.5" />
                        {conv.pinned ? t('common.unpin') : t('common.pin')}
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem onClick={() => handleClearOpen(conv.id)}>
                        <Eraser className="mr-2 h-3.5 w-3.5" />
                        {t('topic.clearMessages')}
                      </ContextMenuItem>
                      <ContextMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => handleDeleteOpen(conv.id)}>
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        {t('common.delete')}
                      </ContextMenuItem>
                    </ContextMenuContent>
                  )}
                </ContextMenu>
              )
            })
          )}
        </div>
      </ScrollArea>

      {/* Multi-select bottom action bar */}
      {isMultiSelect && (
        <>
          <div className="mx-3 border-t" />
          <div className="flex items-center gap-1 px-2 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 text-xs"
              onClick={handleSelectAll}>
              {selectedIds.size === topicConversations.length
                ? t('topic.cancelSelect')
                : t('topic.selectAll')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-7 shrink-0 text-xs"
              disabled={selectedIds.size === 0 || isStreaming}
              onClick={handleDeleteMany}>
              {t('topic.deleteSelected')}
              {selectedIds.size > 0 && ` (${selectedIds.size})`}
            </Button>
            <div className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              className="h-7 shrink-0 text-xs"
              onClick={handleToggleMultiSelect}>
              {t('common.cancel')}
            </Button>
          </div>
        </>
      )}

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('topic.renameTitle')}</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder={t('topic.topicTitlePlaceholder')}
            onKeyDown={(e) => e.key === 'Enter' && handleRenameConfirm()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleRenameConfirm}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Single Confirmation Dialog */}
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

      {/* Delete Many Confirmation Dialog */}
      <Dialog open={deleteManyDialogOpen} onOpenChange={setDeleteManyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('topic.deleteSelectedTitle')}</DialogTitle>
            <DialogDescription>
              {t('topic.deleteSelectedDescription', { count: selectedIds.size })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteManyDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDeleteManyConfirm}>
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
