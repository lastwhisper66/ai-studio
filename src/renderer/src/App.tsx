import { useEffect } from 'react'
import { AppLayout } from '@renderer/components/layout/AppLayout'
import { useConversationStore } from '@renderer/stores/conversationStore'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { useProviderStore } from '@renderer/stores/providerStore'
import { useKeyboardShortcuts } from '@renderer/hooks/useKeyboardShortcuts'

function App(): React.JSX.Element {
  const loadConversations = useConversationStore((s) => s.loadConversations)
  const loadSettings = useSettingsStore((s) => s.loadSettings)
  const loadProviders = useProviderStore((s) => s.loadProviders)

  useEffect(() => {
    loadConversations()
    loadSettings()
    loadProviders()
  }, [loadConversations, loadSettings, loadProviders])

  useKeyboardShortcuts()

  return <AppLayout />
}

export default App
