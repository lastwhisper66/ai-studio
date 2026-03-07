import { ChatView } from '@renderer/components/chat/ChatView'

interface ChatPanelProps {
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
}

export function ChatPanel({
  sidebarCollapsed,
  onToggleSidebar,
}: ChatPanelProps): React.JSX.Element {
  return <ChatView sidebarCollapsed={sidebarCollapsed} onToggleSidebar={onToggleSidebar} />
}
