import { useEffect } from 'react'
import { useConversationStore } from '@renderer/stores/conversationStore'
import { useSettingsStore } from '@renderer/stores/settingsStore'

export function useKeyboardShortcuts(): void {
  const createConversation = useConversationStore((s) => s.createConversation)
  const stopGeneration = useConversationStore((s) => s.stopGeneration)
  const isStreaming = useConversationStore((s) => s.isStreaming)
  const requestInputFocus = useConversationStore((s) => s.requestInputFocus)
  const setActiveView = useSettingsStore((s) => s.setActiveView)

  // Ctrl+, toggle settings — handled via main process before-input-event to bypass IME
  useEffect(() => {
    return window.api.onToggleSettings(() => {
      const current = useSettingsStore.getState().activeView
      const next = current === 'settings' ? 'chat' : 'settings'
      setActiveView(next)
      if (next === 'chat') requestInputFocus()
    })
  }, [setActiveView, requestInputFocus])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      // Ctrl+N → New conversation
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault()
        createConversation()
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
  }, [createConversation, stopGeneration, isStreaming])
}
