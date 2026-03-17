import { ChatView } from '@renderer/components/chat/ChatView'

interface ChatPanelProps {
  topicCollapsed: boolean
  onToggleTopic: () => void
}

export function ChatPanel({ topicCollapsed, onToggleTopic }: ChatPanelProps): React.JSX.Element {
  return <ChatView topicCollapsed={topicCollapsed} onToggleTopic={onToggleTopic} />
}
