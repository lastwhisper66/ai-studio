import { useEffect } from 'react'
import { AppLayout } from '@renderer/components/layout/AppLayout'
import { useConversationStore } from '@renderer/stores/conversationStore'
import { useSettingsStore } from '@renderer/stores/settingsStore'

function App(): React.JSX.Element {
  const loadConversations = useConversationStore((s) => s.loadConversations)
  const loadSettings = useSettingsStore((s) => s.loadSettings)

  useEffect(() => {
    loadConversations()
    loadSettings()
  }, [loadConversations, loadSettings])

  return <AppLayout />
}

export default App
