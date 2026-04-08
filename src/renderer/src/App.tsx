import { useEffect } from 'react'
import { AppLayout } from '@renderer/components/layout/AppLayout'
import { useConversationStore } from '@renderer/stores/conversationStore'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { useProviderStore } from '@renderer/stores/providerStore'
import { useAssistantStore } from '@renderer/stores/assistantStore'
import { usePhraseStore } from '@renderer/stores/phraseStore'
import { useModelDefinitionStore } from '@renderer/stores/modelDefinitionStore'
import { useModelGroupStore } from '@renderer/stores/modelGroupStore'
import { useKeybindingStore } from '@renderer/stores/keybindingStore'
import { useKeyboardShortcuts } from '@renderer/hooks/useKeyboardShortcuts'

function App(): React.JSX.Element {
  const loadConversations = useConversationStore((s) => s.loadConversations)
  const loadSettings = useSettingsStore((s) => s.loadSettings)
  const loadProviders = useProviderStore((s) => s.loadProviders)
  const loadAssistants = useAssistantStore((s) => s.loadAssistants)
  const loadPhrases = usePhraseStore((s) => s.loadPhrases)
  const loadModelDefinitions = useModelDefinitionStore((s) => s.load)
  const loadModelGroups = useModelGroupStore((s) => s.load)
  const initKeybindings = useKeybindingStore((s) => s.init)
  const settingsLoaded = useSettingsStore((s) => s.isLoaded)

  useEffect(() => {
    loadConversations()
    loadSettings()
    loadProviders()
    loadAssistants()
    loadPhrases()
    loadModelDefinitions()
    loadModelGroups()
  }, [
    loadConversations,
    loadSettings,
    loadProviders,
    loadAssistants,
    loadPhrases,
    loadModelDefinitions,
    loadModelGroups,
  ])

  // Initialize keybinding store after settings are loaded
  useEffect(() => {
    if (settingsLoaded) initKeybindings()
  }, [settingsLoaded, initKeybindings])

  useKeyboardShortcuts()

  return <AppLayout />
}

export default App
