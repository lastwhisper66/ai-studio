import { useEffect } from 'react'
import { AppLayout } from '@renderer/components/layout/AppLayout'
import { useConversationStore } from '@renderer/stores/conversationStore'

function App(): React.JSX.Element {
  const loadConversations = useConversationStore((s) => s.loadConversations)

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  return <AppLayout />
}

export default App
