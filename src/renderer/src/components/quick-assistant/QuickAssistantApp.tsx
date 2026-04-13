import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Pencil } from 'lucide-react'
import { useQuickActionStore } from '@renderer/stores/quickActionStore'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import type { QuickAction } from '@shared/types'
import { ActionList } from './ActionList'
import { QuickAssistantResult } from './QuickAssistantResult'

type ViewState = 'input' | 'result'

export function QuickAssistantApp(): React.JSX.Element {
  const { actions, loadActions, isLoaded } = useQuickActionStore()
  const loadSettings = useSettingsStore((s) => s.loadSettings)
  const settings = useSettingsStore((s) => s.settings)

  const [view, setView] = useState<ViewState>('input')
  const [inputText, setInputText] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [resultContent, setResultContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const readySignalled = useRef(false)

  // Load data on mount
  useEffect(() => {
    loadActions()
    loadSettings()
  }, [loadActions, loadSettings])

  // Clean up all streaming listeners when the component unmounts
  // (e.g. window destroyed while a request is in-flight)
  useEffect(() => {
    return () => window.api.removeAllQuickAssistantListeners()
  }, [])

  // Signal main process that we're ready to be shown (once)
  useEffect(() => {
    if (isLoaded && !readySignalled.current) {
      readySignalled.current = true
      window.api.quickAssistantReady()
    }
  }, [isLoaded])

  // Show all enabled actions (no filtering — input is the content to process)
  const enabledActions = useMemo(() => actions.filter((a) => a.enabled), [actions])

  // Reset state when the window loses focus (blur → hide).
  // This ensures the DOM is already in the clean initial state
  // BEFORE the next show(), eliminating the flash.
  useEffect(() => {
    const handleBlur = (): void => {
      setView('input')
      setInputText('')
      setSelectedIndex(0)
      setResultContent('')
      setError(null)
      setIsStreaming(false)
      window.api.removeAllQuickAssistantListeners()
    }
    window.addEventListener('blur', handleBlur)
    return () => window.removeEventListener('blur', handleBlur)
  }, [])

  // Focus input and refresh data when the window is shown
  useEffect(() => {
    const handleFocus = (): void => {
      loadActions()
      loadSettings()
      setTimeout(() => inputRef.current?.focus(), 50)
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [loadActions, loadSettings])

  // Auto-focus input when returning to input view (e.g. from result via Back)
  useEffect(() => {
    if (view !== 'input') return
    const timer = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(timer)
  }, [view])

  const executeAction = useCallback(
    (action: QuickAction) => {
      if (!inputText.trim() || isStreaming) return

      const providerId = settings['quickAssistant.providerId']
      const modelId = settings['quickAssistant.modelId']

      // Switch to result view
      setView('result')
      setResultContent('')
      setError(null)
      setIsStreaming(true)

      // Remove stale listeners
      window.api.removeAllQuickAssistantListeners()

      // Register listeners before firing request
      let cleanedUp = false
      const cleanup = (): void => {
        if (cleanedUp) return
        cleanedUp = true
        unsubChunk()
        unsubEnd()
        unsubError()
      }

      const unsubChunk = window.api.onQuickAssistantChunk((data) => {
        setResultContent((prev) => prev + data.delta)
      })

      const unsubEnd = window.api.onQuickAssistantEnd(() => {
        setIsStreaming(false)
        cleanup()
      })

      const unsubError = window.api.onQuickAssistantError((data) => {
        setError(data.error)
        setIsStreaming(false)
        cleanup()
      })

      // Fire request
      window.api.quickAssistantRequest({
        text: inputText.trim(),
        actionId: action.id,
        providerId: providerId || undefined,
        modelId: modelId || undefined,
      })
    },
    [inputText, settings, isStreaming],
  )

  const handleStop = useCallback(async () => {
    await window.api.stopQuickAssistant()
  }, [])

  const handleBack = useCallback(async () => {
    if (isStreaming) {
      await window.api.stopQuickAssistant()
    }
    window.api.removeAllQuickAssistantListeners()
    setView('input')
    setResultContent('')
    setError(null)
    setIsStreaming(false)
  }, [isStreaming])

  // Global keyboard handler
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (view === 'result') {
          handleBack()
        } else {
          window.api.closeQuickAssistant()
        }
        return
      }

      if (view === 'input') {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSelectedIndex((prev) => (prev < enabledActions.length - 1 ? prev + 1 : 0))
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : enabledActions.length - 1))
        } else if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          const action = enabledActions[selectedIndex]
          if (action && inputText.trim()) {
            executeAction(action)
          }
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [view, enabledActions, selectedIndex, inputText, executeAction, handleBack])

  if (!isLoaded) {
    return <div className="bg-background h-full rounded-xl" />
  }

  return (
    <div className="bg-background flex h-screen flex-col overflow-hidden rounded-xl border shadow-2xl">
      {view === 'input' ? (
        <>
          {/* Search input */}
          <div className="flex items-center gap-3 border-b px-4 py-3">
            <Pencil className="text-muted-foreground h-4 w-4 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="输入要处理的内容，选择下方功能后按 Enter 执行..."
              className="bg-transparent text-foreground placeholder:text-muted-foreground flex-1 text-sm outline-none"
            />
          </div>

          {/* Action list */}
          <div className="flex-1 overflow-auto">
            <ActionList
              actions={enabledActions}
              selectedIndex={selectedIndex}
              onSelect={setSelectedIndex}
              onExecute={(action) => {
                if (inputText.trim()) executeAction(action)
              }}
            />
          </div>

          {/* Footer hint */}
          <div className="text-muted-foreground flex items-center justify-between border-t px-4 py-2 text-xs">
            <span>Esc 关闭</span>
            <span>↑↓ 选择 · Enter 执行</span>
          </div>
        </>
      ) : (
        <QuickAssistantResult
          content={resultContent}
          isStreaming={isStreaming}
          error={error}
          onStop={handleStop}
          onBack={handleBack}
        />
      )}
    </div>
  )
}
