import { useEffect } from 'react'
import { matchesShortcut } from '@shared/keybindings'
import { useConversationStore } from '@renderer/stores/conversationStore'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { useKeybindingStore } from '@renderer/stores/keybindingStore'

export function useKeyboardShortcuts(): void {
  const createConversation = useConversationStore((s) => s.createConversation)
  const stopGeneration = useConversationStore((s) => s.stopGeneration)
  const isStreaming = useConversationStore((s) => s.isStreaming)
  const requestInputFocus = useConversationStore((s) => s.requestInputFocus)
  const setActiveView = useSettingsStore((s) => s.setActiveView)
  const getEffectiveAccelerator = useKeybindingStore((s) => s.getEffectiveAccelerator)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      const toggleSettingsAccel = getEffectiveAccelerator('toggle-settings')
      if (matchesShortcut(e, toggleSettingsAccel)) {
        e.preventDefault()
        const current = useSettingsStore.getState().activeView
        const next = current === 'settings' ? 'chat' : 'settings'
        setActiveView(next)
        if (next === 'chat') requestInputFocus()
        return
      }

      const newConvAccel = getEffectiveAccelerator('new-conversation')
      if (matchesShortcut(e, newConvAccel)) {
        e.preventDefault()
        createConversation()
        return
      }

      const stopAccel = getEffectiveAccelerator('stop-generation')
      if (matchesShortcut(e, stopAccel) && isStreaming) {
        e.preventDefault()
        stopGeneration()
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [
    createConversation,
    stopGeneration,
    isStreaming,
    getEffectiveAccelerator,
    setActiveView,
    requestInputFocus,
  ])
}
