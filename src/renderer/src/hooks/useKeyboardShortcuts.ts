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
  const getAccelerator = useKeybindingStore((s) => s.getAccelerator)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      const toggleSettingsAccel = getAccelerator('toggle-settings')
      if (matchesShortcut(e, toggleSettingsAccel)) {
        e.preventDefault()
        const current = useSettingsStore.getState().activeView
        const next = current === 'settings' ? 'chat' : 'settings'
        setActiveView(next)
        if (next === 'chat') requestInputFocus()
        return
      }

      const newConvAccel = getAccelerator('new-conversation')
      if (matchesShortcut(e, newConvAccel)) {
        e.preventDefault()
        createConversation()
        return
      }

      const stopAccel = getAccelerator('stop-generation')
      if (matchesShortcut(e, stopAccel) && isStreaming) {
        e.preventDefault()
        stopGeneration()
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [createConversation, stopGeneration, isStreaming, getAccelerator, setActiveView, requestInputFocus])
}
