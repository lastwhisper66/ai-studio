import { useState, useMemo } from 'react'
import { Plus, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { useAssistantStore } from '@renderer/stores/assistantStore'
import { AssistantPickerDialog } from '@renderer/components/chat/AssistantPickerDialog'
import { useConversationStore } from '@renderer/stores/conversationStore'

interface AssistantSidebarProps {
  collapsed: boolean
}

interface GroupedAssistants {
  name: string
  assistants: Array<{
    id: string
    name: string
    emoji: string
    description: string
    isDefault: boolean
  }>
}

export function AssistantSidebar({ collapsed }: AssistantSidebarProps): React.JSX.Element {
  const { assistants, activeAssistantId, setActiveAssistantId } = useAssistantStore()
  const { conversations, createConversation, setActiveConversation } = useConversationStore()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

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

  const handlePickerSelect = async (assistantId: string): Promise<void> => {
    setActiveAssistantId(assistantId)
    await createConversation(undefined, assistantId)
  }

  return (
    <aside
      className={`flex h-full flex-col border-r bg-sidebar-background text-sidebar-foreground transition-all duration-300 ${
        collapsed ? 'w-0 overflow-hidden' : 'w-56'
      }`}>
      {/* Add Assistant Button */}
      <div className="mx-2 mt-2 mb-1">
        <Button
          variant="outline"
          className="h-9 w-full justify-start gap-2 text-sm"
          onClick={() => setPickerOpen(true)}>
          <Plus className="h-4 w-4" />
          添加助手
        </Button>
      </div>

      {/* Default Assistant */}
      {defaultAssistant && (
        <div
          className={`group mx-2 mt-1 flex cursor-pointer items-center rounded-lg px-3 py-2.5 ${
            activeAssistantId === defaultAssistant.id
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-foreground hover:bg-sidebar-accent/50'
          }`}
          onClick={() => handleAssistantClick(defaultAssistant.id)}>
          <span className="text-base leading-none">{defaultAssistant.emoji}</span>
          <span className="ml-2 truncate text-sm font-medium">{defaultAssistant.name}</span>
        </div>
      )}

      {/* Divider */}
      <div className="mx-3 my-1.5 border-b" />

      {/* Grouped Assistants */}
      <ScrollArea className="flex-1 px-2">
        <div className="space-y-0.5 pb-2">
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
              {(!group.name || !collapsedGroups[group.name]) &&
                group.assistants.map((a) => (
                  <div
                    key={a.id}
                    className={`group flex cursor-pointer items-center rounded-lg px-3 py-2 ${
                      activeAssistantId === a.id
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-foreground hover:bg-sidebar-accent/50'
                    }`}
                    onClick={() => handleAssistantClick(a.id)}>
                    <span className="shrink-0 text-sm leading-none">{a.emoji}</span>
                    <span className="ml-2 truncate text-sm">{a.name}</span>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Assistant Picker Dialog */}
      <AssistantPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        assistants={assistants}
        onSelect={handlePickerSelect}
      />
    </aside>
  )
}
