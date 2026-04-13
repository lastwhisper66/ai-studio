import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Pencil } from 'lucide-react'
import { useQuickActionStore } from '@renderer/stores/quickActionStore'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { generateTranslatePrompt, getLanguageLabel } from '@renderer/lib/languages'
import i18n from '@renderer/i18n'
import type { QuickAction } from '@shared/types'
import { ActionList } from './ActionList'
import { QuickAssistantResult } from './QuickAssistantResult'

const BUILTIN_TRANSLATE_ID = 'builtin-translate'

type ViewState = 'input' | 'result'

export function QuickAssistantApp(): React.JSX.Element {
  const { actions, loadActions, isLoaded } = useQuickActionStore()
  const loadSettings = useSettingsStore((s) => s.loadSettings)
  const saveSettings = useSettingsStore((s) => s.saveSettings)
  const settings = useSettingsStore((s) => s.settings)

  const [view, setView] = useState<ViewState>('input')
  const [inputText, setInputText] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [resultContent, setResultContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentAction, setCurrentAction] = useState<QuickAction | null>(null)
  const targetLang = settings['quickAssistant.translateTargetLang'] || i18n.language || 'en'
  const activeTargetLangRef = useRef<string | null>(null)
  const retranslateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const readySignalled = useRef(false)

  // Load data on mount
  useEffect(() => {
    loadActions()
    loadSettings()
  }, [loadActions, loadSettings])

  // Clean up all streaming listeners and pending timers when the component unmounts
  // (e.g. window destroyed while a request is in-flight)
  useEffect(() => {
    return () => {
      window.api.removeAllQuickAssistantListeners()
      if (retranslateTimerRef.current !== null) {
        clearTimeout(retranslateTimerRef.current)
        retranslateTimerRef.current = null
      }
    }
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
      setCurrentAction(null)
      activeTargetLangRef.current = null
      if (retranslateTimerRef.current !== null) {
        clearTimeout(retranslateTimerRef.current)
        retranslateTimerRef.current = null
      }
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
    (action: QuickAction, overrideTargetLang?: string) => {
      if (!inputText.trim() || (isStreaming && overrideTargetLang === undefined)) return

      const providerId = settings['quickAssistant.providerId']
      const modelId = settings['quickAssistant.modelId']

      // Build system prompt override for translate action
      let systemPromptOverride: string | undefined
      if (action.id === BUILTIN_TRANSLATE_ID) {
        const lang = overrideTargetLang ?? targetLang
        systemPromptOverride = generateTranslatePrompt(getLanguageLabel(lang))
        activeTargetLangRef.current = lang
      }

      // Switch to result view
      setView('result')
      setCurrentAction(action)
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
        systemPromptOverride,
      })
    },
    [inputText, settings, targetLang, isStreaming],
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
    setCurrentAction(null)
    activeTargetLangRef.current = null
    if (retranslateTimerRef.current !== null) {
      clearTimeout(retranslateTimerRef.current)
      retranslateTimerRef.current = null
    }
  }, [isStreaming])

  const handleTargetLangChange = useCallback(
    async (newLang: string) => {
      // Skip if same language is already being translated
      if (newLang === activeTargetLangRef.current) return

      saveSettings({ 'quickAssistant.translateTargetLang': newLang })

      // Immediately clear stale content so the UI shows a loading state
      setResultContent('')
      setError(null)
      setIsStreaming(true)

      // Stop current translation if streaming
      if (isStreaming) {
        await window.api.stopQuickAssistant()
      }
      window.api.removeAllQuickAssistantListeners()

      // Cancel any previously scheduled re-translation
      if (retranslateTimerRef.current !== null) {
        clearTimeout(retranslateTimerRef.current)
      }

      // Re-translate with new language
      if (currentAction) {
        // Small delay to ensure abort completes
        retranslateTimerRef.current = setTimeout(() => {
          retranslateTimerRef.current = null
          executeAction(currentAction, newLang)
        }, 50)
      }
    },
    [isStreaming, currentAction, executeAction, saveSettings],
  )

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

  const isTranslateAction = currentAction?.id === BUILTIN_TRANSLATE_ID

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
          isTranslateAction={isTranslateAction}
          targetLang={targetLang}
          onTargetLangChange={handleTargetLangChange}
        />
      )}
    </div>
  )
}
