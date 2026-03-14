import { useEffect } from 'react'
import { useConversationStore } from '@renderer/stores/conversationStore'
import { useSettingsStore } from '@renderer/stores/settingsStore'

export function useKeyboardShortcuts(): void {
  const createConversation = useConversationStore((s) => s.createConversation)
  const stopGeneration = useConversationStore((s) => s.stopGeneration)
  const isStreaming = useConversationStore((s) => s.isStreaming)
  const setActiveView = useSettingsStore((s) => s.setActiveView)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      // Ctrl+N → New conversation
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault()
        createConversation()
        return
      }

      // Ctrl+, → Toggle settings
      if (e.ctrlKey && e.key === ',') {
        e.preventDefault()
        const current = useSettingsStore.getState().activeView
        setActiveView(current === 'settings' ? 'chat' : 'settings')
        return
      }

      // Escape → Stop generation (works even in input fields)
      if (e.key === 'Escape' && isStreaming) {
        e.preventDefault()
        stopGeneration()
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [createConversation, stopGeneration, isStreaming, setActiveView])
}
