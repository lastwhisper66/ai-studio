import { useState } from 'react'
import { Plus, Search, MoreHorizontal, Pencil, Trash2, PanelLeftClose, Eraser } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@renderer/components/ui/dialog'
import { useConversationStore } from '@renderer/stores/conversationStore'
import { useAssistantStore } from '@renderer/stores/assistantStore'
import { AssistantPickerDialog } from '@renderer/components/chat/AssistantPickerDialog'

interface ConversationPanelProps {
  collapsed: boolean
  onToggle: () => void
}

export function ConversationPanel({
  collapsed,
  onToggle,
}: ConversationPanelProps): React.JSX.Element {
  const {
    conversations,
    activeConversationId,
    createConversation,
    deleteConversation,
    renameConversation,
    setActiveConversation,
    clearMessages,
  } = useConversationStore()

  const { assistants } = useAssistantStore()

  const defaultAssistant = assistants.find((a) => a.isDefault)
  const assistantMap = new Map(assistants.map((a) => [a.id, a]))

  const [searchQuery, setSearchQuery] = useState('')
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const filteredConversations = searchQuery
    ? conversations.filter((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : conversations

  const handleDefaultAssistantClick = async (): Promise<void> => {
    if (!defaultAssistant) return
    // Find the most recent conversation associated with the default assistant
    const existing = conversations.find((c) => c.assistantId === defaultAssistant.id)
    if (existing) {
      setActiveConversation(existing.id)
    } else {
      createConversation(undefined, defaultAssistant.id)
    }
  }

  const handleClearDefaultMessages = async (): Promise<void> => {
    if (!defaultAssistant) return
    const existing = conversations.find((c) => c.assistantId === defaultAssistant.id)
    if (existing) {
      clearMessages(existing.id)
    }
  }

  const handlePickerSelect = (assistantId: string): void => {
    createConversation(undefined, assistantId)
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

  return (
    <aside
      className={`flex h-full flex-col border-r bg-sidebar-background text-sidebar-foreground transition-all duration-300 ${
        collapsed ? 'w-0 overflow-hidden' : 'w-70'
      }`}>
      {/* Default Assistant — pinned top */}
      {defaultAssistant && (
        <div
          className={`group mx-2 mt-2 flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 ${
            conversations.some(
              (c) => c.assistantId === defaultAssistant.id && c.id === activeConversationId,
            )
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-foreground hover:bg-sidebar-accent/50'
          }`}
          onClick={handleDefaultAssistantClick}>
          <div className="flex items-center gap-2 truncate">
            <span className="text-base leading-none">{defaultAssistant.emoji}</span>
            <span className="truncate text-sm font-medium">{defaultAssistant.name}</span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}>
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleClearDefaultMessages}>
                <Eraser className="mr-2 h-4 w-4" />
                清空消息
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Divider */}
      <div className="mx-3 my-1 border-b" />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-sm font-semibold">Conversations</span>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setPickerOpen(true)}>
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">选择助手开始新对话</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggle}>
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Collapse</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search..."
            className="h-8 pl-8 text-xs"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Conversation list */}
      <ScrollArea className="flex-1 px-2">
        <div className="space-y-1">
          {filteredConversations.map((conv) => {
            const assistant = conv.assistantId ? assistantMap.get(conv.assistantId) : undefined

            return (
              <div
                key={conv.id}
                className={`group flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm ${
                  activeConversationId === conv.id
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                }`}
                onClick={() => setActiveConversation(conv.id)}>
                <div className="flex items-center gap-2 truncate">
                  {assistant && (
                    <span className="shrink-0 text-sm leading-none">{assistant.emoji}</span>
                  )}
                  <span className="truncate">{conv.title}</span>
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
            )
          })}
        </div>
      </ScrollArea>

      {/* Assistant Picker Dialog */}
      <AssistantPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        assistants={assistants}
        onSelect={handlePickerSelect}
      />

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Conversation</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameConfirm()
            }}
            placeholder="Conversation title"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenameConfirm}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Conversation</DialogTitle>
            <DialogDescription>
              This will permanently delete this conversation and all its messages. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  )
}
