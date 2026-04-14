import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Pin, PinOff, X, ArrowLeft, Square, GripVertical } from 'lucide-react'
import { useQuickActionStore } from '@renderer/stores/quickActionStore'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { useFontSettings } from '@renderer/hooks/useFontSettings'
import {
  generateTranslatePrompt,
  generateImageTranslatePrompt,
  getLanguageEnglishLabel,
  LANGUAGES,
} from '@renderer/lib/languages'
import i18n from '@renderer/i18n'
import type { QuickAction } from '@shared/types'
import type { FileData } from '@shared/types'
import { isImageMime } from '@shared/types'
import { ActionList } from './ActionList'
import { QuickAssistantResult } from './QuickAssistantResult'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'

const BUILTIN_TRANSLATE_ID = 'builtin-translate'
const BUILTIN_IMAGE_TRANSLATE_ID = 'builtin-image-translate'

type ViewState = 'input' | 'result'

export function QuickAssistantApp(): React.JSX.Element {
  const { t } = useTranslation()
  const { actions, loadActions, isLoaded } = useQuickActionStore()
  const loadSettings = useSettingsStore((s) => s.loadSettings)
  const saveSettings = useSettingsStore((s) => s.saveSettings)
  const settings = useSettingsStore((s) => s.settings)

  useFontSettings()

  const [view, setView] = useState<ViewState>('input')
  const [inputText, setInputText] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [resultContent, setResultContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentAction, setCurrentAction] = useState<QuickAction | null>(null)
  const [pinned, setPinned] = useState(false)
  const pinnedRef = useRef(false)
  const [attachedFiles, setAttachedFiles] = useState<FileData[]>([])
  const [warning, setWarning] = useState<string | null>(null)
  const targetLang = settings['quickAssistant.translateTargetLang'] || i18n.language || 'en'
  const activeTargetLangRef = useRef<string | null>(null)
  const retranslateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const readySignalled = useRef(false)
  const wasHiddenRef = useRef(true)
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const modelId = settings['quickAssistant.modelId'] || ''

  /** Flash a short warning message that auto-dismisses after 2 s */
  const showWarning = useCallback((msg: string) => {
    if (warningTimerRef.current !== null) clearTimeout(warningTimerRef.current)
    setWarning(msg)
    warningTimerRef.current = setTimeout(() => {
      setWarning(null)
      warningTimerRef.current = null
    }, 2000)
  }, [])

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
      if (warningTimerRef.current !== null) {
        clearTimeout(warningTimerRef.current)
        warningTimerRef.current = null
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

  // Helper to reset all UI state to initial
  const resetState = useCallback(() => {
    setView('input')
    setInputText('')
    setSelectedIndex(0)
    setResultContent('')
    setError(null)
    setIsStreaming(false)
    setCurrentAction(null)
    setAttachedFiles([])
    setWarning(null)
    activeTargetLangRef.current = null
    if (retranslateTimerRef.current !== null) {
      clearTimeout(retranslateTimerRef.current)
      retranslateTimerRef.current = null
    }
    window.api.removeAllQuickAssistantListeners()
  }, [])

  // Reset state when the window loses focus (blur -> hide).
  // This ensures the DOM is already in the clean initial state
  // BEFORE the next show(), eliminating the flash.
  //
  // NOTE: When `pinned` is true the blur handler is skipped — the user wants
  // the window to stay visible. In that case, `visibilitychange` (below)
  // still marks `wasHiddenRef` when the BrowserWindow is explicitly hidden
  // via hide(), so the next focus handler knows to do a full reset.
  useEffect(() => {
    const handleBlur = (): void => {
      if (pinnedRef.current) return
      wasHiddenRef.current = true
      resetState()
    }
    window.addEventListener('blur', handleBlur)
    return () => window.removeEventListener('blur', handleBlur)
  }, [resetState])

  // Complement to the blur handler above: BrowserWindow.hide() changes
  // `document.visibilityState` to "hidden" even when `pinned` is true
  // (where the blur handler is a no-op). This guarantees `wasHiddenRef`
  // is always set when the window disappears, regardless of pin state.
  //
  // The focus handler below checks `wasHiddenRef` to distinguish a genuine
  // "window re-shown" from a transient focus return (e.g. closing a
  // Select dropdown portal that temporarily stole focus).
  useEffect(() => {
    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'hidden') {
        wasHiddenRef.current = true
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  /**
   * Core streaming helper — registers chunk/end/error listeners and fires
   * the quick-assistant request. Shared by executeAction and auto-execute.
   */
  const startStreamingRequest = useCallback(
    (params: {
      action: QuickAction
      text: string
      files?: FileData[]
      overrideTargetLang?: string
    }) => {
      const { action, text, files, overrideTargetLang } = params
      const providerId = settings['quickAssistant.providerId']
      const settingsModelId = settings['quickAssistant.modelId']

      // Build system prompt override for translate actions
      let systemPromptOverride: string | undefined
      if (action.id === BUILTIN_TRANSLATE_ID) {
        const lang = overrideTargetLang ?? targetLang
        systemPromptOverride = generateTranslatePrompt(getLanguageEnglishLabel(lang))
        activeTargetLangRef.current = lang
      } else if (action.id === BUILTIN_IMAGE_TRANSLATE_ID) {
        const lang = overrideTargetLang ?? targetLang
        systemPromptOverride = generateImageTranslatePrompt(getLanguageEnglishLabel(lang))
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
        text,
        actionId: action.id,
        providerId: providerId || undefined,
        modelId: settingsModelId || undefined,
        systemPromptOverride,
        files: files && files.length > 0 ? files : undefined,
      })
    },
    [settings, targetLang],
  )

  const executeAction = useCallback(
    (action: QuickAction, overrideTargetLang?: string) => {
      if (!inputText.trim() && attachedFiles.length === 0) return
      if (isStreaming && overrideTargetLang === undefined) return

      startStreamingRequest({
        action,
        text: inputText.trim(),
        files: attachedFiles,
        overrideTargetLang,
      })
    },
    [inputText, attachedFiles, isStreaming, startStreamingRequest],
  )

  // Focus input and refresh data when the window is shown (first focus after hide)
  useEffect(() => {
    const handleFocus = (): void => {
      loadActions()
      // Only reset pin on a fresh show (after the window was hidden), not on
      // focus-return from child elements like dropdown portals
      if (wasHiddenRef.current) {
        resetState()

        // Sync local pinned state from store after settings are loaded.
        // The main process already applied the correct alwaysOnTop + pinned
        // state before showing the window, so we only update the display state
        // here — no need to send setQuickAssistantPinned back to main.
        //
        // We clear wasHiddenRef AFTER the default pin is applied so that any
        // blur event firing before loadSettings resolves will see the ref as
        // true and skip hiding — preventing a race where the window disappears
        // before the default-pinned preference is read.
        loadSettings().then(() => {
          const s = useSettingsStore.getState().settings
          const defaultPin = s['quickAssistant.defaultPinned'] === 'true'
          setPinned(defaultPin)
          pinnedRef.current = defaultPin
          wasHiddenRef.current = false
        })

        // Check for pending auto-execute payload (set by screenshot flow)
        window.api.getPendingAutoExecute().then((result) => {
          if (!result.success || !result.data) return
          const payload = result.data
          const action = actions.find((a) => a.enabled && a.id === payload.actionId)
          if (!action || !payload.files?.length) return

          setAttachedFiles(payload.files)
          setInputText('')
          startStreamingRequest({
            action,
            text: '',
            files: payload.files,
            overrideTargetLang: payload.targetLang,
          })
        })
      } else {
        loadSettings()
      }
      setTimeout(() => inputRef.current?.focus(), 50)
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [loadActions, loadSettings, resetState, actions, startStreamingRequest])

  // Auto-focus input when returning to input view (e.g. from result via Back)
  useEffect(() => {
    if (view !== 'input') return
    const timer = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(timer)
  }, [view])

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

  const handleTogglePin = useCallback(() => {
    const next = !pinned
    setPinned(next)
    pinnedRef.current = next
    window.api.setQuickAssistantPinned(next)
  }, [pinned])

  // Handle image paste from clipboard (only 1 image allowed)
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (isImageMime(item.type)) {
          e.preventDefault()

          // Only allow a single image attachment
          if (attachedFiles.length >= 1) {
            showWarning(t('settings.quickAssistant.warningImageLimit'))
            return
          }

          const blob = item.getAsFile()
          if (!blob) continue
          const mimeType = item.type
          const reader = new FileReader()
          reader.onload = (): void => {
            const dataUrl = reader.result as string
            const base64 = dataUrl.split(',')[1]
            if (base64) {
              setAttachedFiles((prev) => [
                ...prev,
                {
                  name: `clipboard-${Date.now()}.${mimeType.split('/')[1] || 'png'}`,
                  mimeType,
                  base64,
                  size: blob.size,
                },
              ])
            }
          }
          reader.onerror = (): void => {
            console.error('[QuickAssistant] Failed to read pasted image')
            showWarning(t('settings.quickAssistant.warningImageReadFailed'))
          }
          reader.readAsDataURL(blob)
          // Stop after the first image item
          return
        }
      }
    },
    [attachedFiles.length, showWarning],
  )

  const removeAttachedFile = useCallback((index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  // Copy result content handler
  const handleCopyResult = useCallback(() => {
    if (resultContent) {
      navigator.clipboard.writeText(resultContent).catch(() => {
        // Silently ignore — clipboard may be unavailable in some environments
      })
    }
  }, [resultContent])

  // Keep frequently-changing values in a ref so the keyboard handler
  // doesn't re-register on every keystroke / state change.
  const kbStateRef = useRef({
    view,
    inputText,
    attachedFiles,
    isStreaming,
    resultContent,
    selectedIndex,
    currentAction,
  })
  kbStateRef.current = {
    view,
    inputText,
    attachedFiles,
    isStreaming,
    resultContent,
    selectedIndex,
    currentAction,
  }

  // Global keyboard handler — reads transient state from kbStateRef,
  // only re-registers when callback identities or enabledActions change.
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const s = kbStateRef.current

      // Ctrl+Shift+C to copy result
      if (
        e.ctrlKey &&
        e.shiftKey &&
        e.key === 'C' &&
        s.view === 'result' &&
        s.resultContent &&
        !s.isStreaming
      ) {
        e.preventDefault()
        handleCopyResult()
        return
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        if (s.view === 'result') {
          handleBack()
        } else if (s.inputText || s.attachedFiles.length > 0) {
          // In input view, clear input instead of closing when there's content
          setInputText('')
          setAttachedFiles([])
        } else {
          window.api.closeQuickAssistant()
        }
        return
      }

      if (s.view === 'input') {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSelectedIndex((prev) => (prev < enabledActions.length - 1 ? prev + 1 : 0))
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : enabledActions.length - 1))
        } else if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          const action = enabledActions[s.selectedIndex]
          if (action && (s.inputText.trim() || s.attachedFiles.length > 0)) {
            executeAction(action)
          }
        }
      } else if (s.view === 'result') {
        // In result view, Enter re-executes with new input
        if (e.key === 'Enter' && !e.shiftKey && s.currentAction) {
          e.preventDefault()
          if (s.inputText.trim() || s.attachedFiles.length > 0) {
            executeAction(s.currentAction)
          }
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [enabledActions, executeAction, handleBack, handleCopyResult])

  if (!isLoaded) {
    return <div className="bg-background h-full rounded-xl" />
  }

  const isTranslateAction =
    currentAction?.id === BUILTIN_TRANSLATE_ID || currentAction?.id === BUILTIN_IMAGE_TRANSLATE_ID
  const placeholderText = modelId
    ? t('settings.quickAssistant.placeholderWithModel', { model: modelId })
    : t('settings.quickAssistant.placeholderDefault')
  const escLabel =
    view === 'result'
      ? t('settings.quickAssistant.escBack')
      : inputText || attachedFiles.length > 0
        ? t('settings.quickAssistant.escClear')
        : t('settings.quickAssistant.escClose')

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="bg-background flex h-full w-full flex-col overflow-hidden rounded-xl border">
        {/* Search input — always visible */}
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <div
            className="text-muted-foreground hover:text-foreground -ml-1 shrink-0 transition-colors"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
            <GripVertical className="h-4 w-4" />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onPaste={handlePaste}
            placeholder={placeholderText}
            className="bg-transparent text-foreground placeholder:text-muted-foreground flex-1 text-sm outline-none"
          />
          <button
            onClick={handleTogglePin}
            className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
            title={
              pinned
                ? t('settings.quickAssistant.unpinWindow')
                : t('settings.quickAssistant.pinWindow')
            }>
            {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          </button>
        </div>

        {/* Image attachment preview */}
        {attachedFiles.length > 0 && (
          <div className="flex gap-2 border-b px-4 py-2">
            {attachedFiles.map((file, index) => (
              <div key={index} className="group relative">
                <img
                  src={`data:${file.mimeType};base64,${file.base64}`}
                  alt={file.name}
                  className="h-12 w-12 rounded-md border object-cover"
                />
                <button
                  onClick={() => removeAttachedFile(index)}
                  className="bg-background/80 text-muted-foreground hover:text-foreground absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border text-xs opacity-0 transition-opacity group-hover:opacity-100">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Content area */}
        {view === 'input' ? (
          <div className="flex-1 overflow-auto">
            <ActionList
              actions={enabledActions}
              selectedIndex={selectedIndex}
              onSelect={setSelectedIndex}
              onExecute={(action) => {
                if (inputText.trim() || attachedFiles.length > 0) executeAction(action)
              }}
            />
          </div>
        ) : (
          <div className="min-h-0 flex-1">
            <QuickAssistantResult content={resultContent} isStreaming={isStreaming} error={error} />
          </div>
        )}

        {/* Footer hint — always visible */}
        <div className="text-muted-foreground flex items-center justify-between border-t px-4 py-2 text-xs">
          <div className="flex items-center gap-1">
            {view === 'result' && (
              <>
                <button
                  onClick={handleBack}
                  className="hover:text-foreground flex items-center gap-1 transition-colors">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {t('settings.quickAssistant.back')}
                </button>
                {isStreaming && (
                  <button
                    onClick={handleStop}
                    className="hover:text-foreground flex items-center gap-1 rounded-md px-2 py-0.5 transition-colors">
                    <Square className="h-3 w-3" />
                    {t('settings.quickAssistant.stop')}
                  </button>
                )}
                {isTranslateAction && targetLang && (
                  <Select value={targetLang} onValueChange={handleTargetLangChange}>
                    <SelectTrigger className="h-6 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper" side="top">
                      {LANGUAGES.map((lang) => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            {warning && <span className="text-amber-500">{warning}</span>}
            {view === 'result' && resultContent && !isStreaming && (
              <span>
                <kbd className="bg-muted rounded px-1 py-0.5 text-[10px] font-medium">
                  Ctrl+Shift+C
                </kbd>{' '}
                {t('settings.quickAssistant.copy')}
              </span>
            )}
            <span>
              <kbd className="bg-muted rounded px-1 py-0.5 text-[10px] font-medium">Esc</kbd>{' '}
              {escLabel}
            </span>
            <span>
              <kbd className="bg-muted rounded px-1 py-0.5 text-[10px] font-medium">↑↓</kbd>{' '}
              {t('settings.quickAssistant.select')}
              {' · '}
              <kbd className="bg-muted rounded px-1 py-0.5 text-[10px] font-medium">Enter</kbd>{' '}
              {t('settings.quickAssistant.execute')}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
