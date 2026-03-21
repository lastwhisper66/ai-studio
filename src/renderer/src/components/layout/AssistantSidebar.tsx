import { useState, useMemo } from 'react'
import { Plus, ChevronDown, ChevronRight, Pencil, Trash2, Copy, Pin } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
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
import { useAssistantStore } from '@renderer/stores/assistantStore'
import { AssistantSettingsDialog } from '@renderer/components/chat/AssistantSettingsDialog'
import { useConversationStore } from '@renderer/stores/conversationStore'

interface AssistantSidebarProps {
  collapsed: boolean
}

interface GroupedAssistants {
  name: string
  assistants: Array<{
    id: string
    name: string
    description: string
    isDefault: boolean
    sortOrder: number
  }>
}

export function AssistantSidebar({ collapsed }: AssistantSidebarProps): React.JSX.Element {
  const { t } = useTranslation()
  const {
    assistants,
    activeAssistantId,
    setActiveAssistantId,
    addAssistant,
    deleteAssistant,
    duplicateAssistant,
    pinAssistant,
  } = useAssistantStore()
  const { conversations, createConversation, setActiveConversation } = useConversationStore()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [editAssistantId, setEditAssistantId] = useState<string | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const defaultAssistant = assistants.find((a) => a.isDefault)
  const nonDefaultAssistants = assistants.filter((a) => !a.isDefault)

  const groups = useMemo(() => {
    const grouped = new Map<string, GroupedAssistants>()
    const ungrouped: GroupedAssistants = { name: '', assistants: [] }

    for (const a of nonDefaultAssistants) {
      const groupName = a.group || ''
      if (!groupName) {
        ungrouped.assistants.push(a)
      } else {
        const existing = grouped.get(groupName)
        if (existing) {
          existing.assistants.push(a)
        } else {
          grouped.set(groupName, { name: groupName, assistants: [a] })
        }
      }
    }

    const result: GroupedAssistants[] = [...grouped.values()]
    if (ungrouped.assistants.length > 0) {
      result.push(ungrouped)
    }
    return result
  }, [nonDefaultAssistants])

  const toggleGroup = (name: string): void => {
    setCollapsedGroups((prev) => ({ ...prev, [name]: !prev[name] }))
  }

  const handleAssistantClick = async (assistantId: string): Promise<void> => {
    setActiveAssistantId(assistantId)
    // Find the most recent conversation for this assistant
    const existing = conversations.find((c) => c.assistantId === assistantId)
    if (existing) {
      await setActiveConversation(existing.id)
    } else {
      await createConversation(undefined, assistantId)
    }
  }

  const handleAddAssistant = async (): Promise<void> => {
    const assistant = await addAssistant({ name: t('assistant.newAssistant'), contextCount: '10' })
    if (assistant) {
      setEditAssistantId(assistant.id)
      setSettingsOpen(true)
    }
  }

  const handleSettingsClose = async (open: boolean): Promise<void> => {
    setSettingsOpen(open)
    if (!open && editAssistantId) {
      // If this was a newly created assistant, switch to it
      const isNew = !conversations.some((c) => c.assistantId === editAssistantId)
      if (isNew) {
        setActiveAssistantId(editAssistantId)
        await createConversation(undefined, editAssistantId)
      }
      setEditAssistantId(null)
    }
  }

  const handleEdit = (id: string): void => {
    setEditAssistantId(id)
    setSettingsOpen(true)
  }

  const handleDeleteOpen = (id: string): void => {
    setDeleteId(id)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async (): Promise<void> => {
    if (deleteId) {
      await deleteAssistant(deleteId)
      // If deleted assistant was active, switch to default
      if (deleteId === activeAssistantId && defaultAssistant) {
        await handleAssistantClick(defaultAssistant.id)
      }
    }
    setDeleteDialogOpen(false)
    setDeleteId(null)
  }

  const isPinned = (a: { sortOrder: number; isDefault: boolean }): boolean =>
    a.sortOrder < 0 && !a.isDefault

  const renderAssistantItem = (a: {
    id: string
    name: string
    isDefault: boolean
    sortOrder: number
  }): React.JSX.Element => (
    <ContextMenu key={a.id}>
      <ContextMenuTrigger asChild>
        <div
          className={`group flex cursor-pointer items-center rounded-xl px-3 transition-all py-2.5 ${
            activeAssistantId === a.id
              ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
              : 'text-foreground hover:bg-sidebar-accent/40'
          }`}
          onClick={() => handleAssistantClick(a.id)}>
          {isPinned(a) && <Pin className="mr-1.5 h-3 w-3 shrink-0 text-muted-foreground" />}
          <span className={`min-w-0 truncate text-sm ${a.isDefault ? 'font-medium' : ''}`}>
            {a.name}
          </span>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => handleEdit(a.id)}>
          <Pencil className="h-4 w-4" />
          {t('assistant.editAssistant')}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => duplicateAssistant(a.id)}>
          <Copy className="h-4 w-4" />
          {t('assistant.duplicateAssistant')}
        </ContextMenuItem>
        {!a.isDefault && (
          <ContextMenuItem onClick={() => pinAssistant(a.id)}>
            <Pin className="h-4 w-4" />
            {isPinned(a) ? t('common.unpin') : t('common.pin')}
          </ContextMenuItem>
        )}
        {!a.isDefault && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" onClick={() => handleDeleteOpen(a.id)}>
              <Trash2 className="h-4 w-4" />
              {t('common.delete')}
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )

  return (
    <aside
      className={`flex h-full flex-col border-r bg-sidebar-background text-sidebar-foreground transition-all duration-300 ${
        collapsed ? 'w-0 overflow-hidden' : 'w-56'
      }`}>
      {/* Add Assistant Button */}
      <div className="mx-2 mt-2 mb-1">
        <Button
          variant="ghost"
          className="h-10 w-full justify-start gap-2 rounded-xl text-sm hover:bg-sidebar-accent/40"
          onClick={handleAddAssistant}>
          <Plus className="h-4 w-4" />
          {t('assistant.addAssistant')}
        </Button>
      </div>

      {/* Default Assistant */}
      {defaultAssistant && (
        <div className="px-2 py-0.5">{renderAssistantItem(defaultAssistant)}</div>
      )}

      {/* Divider */}
      <div className="mx-3 my-1.5 border-b" />

      {/* Grouped Assistants */}
      <ScrollArea className="flex-1 px-2">
        <div className="space-y-2 pb-2">
          {groups.map((group) => (
            <div key={group.name || '__ungrouped__'}>
              {/* Group header — only for named groups */}
              {group.name && (
                <button
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => toggleGroup(group.name)}>
                  {collapsedGroups[group.name] ? (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="truncate">{group.name}</span>
                  <span className="ml-auto text-[11px] text-muted-foreground/60">
                    {group.assistants.length}
                  </span>
                </button>
              )}

              {/* Group items */}
              {(!group.name || !collapsedGroups[group.name]) && (
                <div className="flex flex-col gap-2">
                  {group.assistants.map((a) => renderAssistantItem(a))}
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Assistant Settings Dialog */}
      <AssistantSettingsDialog
        open={settingsOpen}
        onOpenChange={handleSettingsClose}
        assistantId={editAssistantId}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('assistant.deleteAssistant')}</DialogTitle>
            <DialogDescription>{t('assistant.deleteDescription')}</DialogDescription>
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
    </aside>
  )
}
