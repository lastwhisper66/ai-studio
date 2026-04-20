import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pin, PinOff, Square, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { MarkdownRenderer } from '@renderer/components/chat/MarkdownRenderer'
import { useSeedTranslator } from '@renderer/hooks/useSeedTranslator'
import { useLocalizedError } from '@renderer/hooks/useLocalizedError'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'
import {
  generateTranslatePrompt,
  getLanguageEnglishLabel,
  LANGUAGES,
} from '@renderer/lib/languages'
import i18n from '@renderer/i18n'
import type { SelectionAction, SelectionBubblePayload } from '@shared/types'
import type { LocalizedError } from '@shared/errors'
import {
  defaultSelectionActionIcon,
  selectionActionIconMap,
} from '@renderer/components/selection-toolbar/icons'

const BUILTIN_SEL_TRANSLATE_ID = 'builtin-sel-translate'

/** Map an arbitrary locale code (e.g. i18n.language) to a LANGUAGES entry. */
function normalizeLangCode(input: string | undefined): string {
  if (!input) return LANGUAGES[0]?.code ?? 'en'
  if (LANGUAGES.some((l) => l.code === input)) return input
  // Try the primary subtag: "en-US" -> "en"
  const primary = input.split('-')[0]
  const match = LANGUAGES.find((l) => l.code === primary || l.code.startsWith(`${primary}-`))
  return match?.code ?? LANGUAGES[0]?.code ?? 'en'
}

export function SelectionBubbleApp(): React.JSX.Element {
  const { t } = useTranslation()
  const resolveError = useLocalizedError()
  const [payload, setPayload] = useState<SelectionBubblePayload | null>(null)
  const [currentActionId, setCurrentActionId] = useState<string>('')
  const [content, setContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<LocalizedError | string | null>(null)
  const [pinned, setPinned] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const [targetLang, setTargetLang] = useState<string>(() => normalizeLangCode(i18n.language))
  /**
   * Gate auto-run on targetLang loading. Otherwise a fresh payload could fire
   * before `selection.translateTargetLang` resolves, making the first translate
   * use the UI locale instead of the user's saved preference.
   */
  const [targetLangLoaded, setTargetLangLoaded] = useState(false)

  const readySignalled = useRef(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  // Mirror targetLang in a ref so auto-run reads the latest value without
  // depending on it in useEffect (which would cause re-runs on lang change).
  const targetLangRef = useRef(targetLang)
  useEffect(() => {
    targetLangRef.current = targetLang
  }, [targetLang])

  // Signal ready once on mount, and subscribe to payload pushes
  useEffect(() => {
    const unsubscribe = window.api.onSelectionBubbleData((data) => {
      setPayload(data)
      setCurrentActionId(data.actionId)
      // Fresh payload — reset everything. Main is the source of truth for the
      // initial pinned state; it reads `selection.defaultPinned` on show.
      setContent('')
      setError(null)
      setPinned(data.pinned)
      setCopySuccess(false)
    })
    if (!readySignalled.current) {
      readySignalled.current = true
      window.api.selectionBubbleReady()
    }
    return unsubscribe
  }, [])

  // Load the user's preferred translate target language once
  useEffect(() => {
    let cancelled = false
    window.api
      .getSetting('selection.translateTargetLang')
      .then((result) => {
        if (cancelled) return
        if (result.success && result.data) {
          setTargetLang(normalizeLangCode(result.data))
        }
      })
      .finally(() => {
        if (!cancelled) setTargetLangLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Stay in sync when the target language is changed from another window
  // (e.g. the Settings → Selection Assistant dialog). Without this, the
  // bubble's dropdown and the settings dialog can display different values.
  useEffect(() => {
    return window.api.onSettingsChanged((entries) => {
      const next = entries['selection.translateTargetLang']
      if (typeof next !== 'string') return
      const normalized = normalizeLangCode(next)
      setTargetLang((prev) => (prev === normalized ? prev : normalized))
    })
  }, [])

  // This window is pre-created at startup; its i18n instance won't observe
  // later language changes in the main window. Subscribe to the main-process
  // broadcast so the header/footer labels stay in sync on the fly.
  useEffect(() => {
    return window.api.onLanguageChanged((lang) => {
      i18n.changeLanguage(lang)
    })
  }, [])

  // Track the latest state/handlers inside the global keydown listener so it
  // doesn't need to re-register (and miss keys during re-render gaps).
  const shortcutStateRef = useRef({
    canRegenerate: false,
    canCopy: false,
    handleRegenerate: (): void => {},
    handleCopy: (): void => {},
  })

  // Esc closes the bubble; R regenerates; Alt+C copies
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        window.api.selectionBubbleClose()
        return
      }
      // Alt+C — copy current result
      if (e.altKey && (e.key === 'c' || e.key === 'C')) {
        if (shortcutStateRef.current.canCopy) {
          e.preventDefault()
          shortcutStateRef.current.handleCopy()
        }
        return
      }
      // R — regenerate (ignore if a modifier is held or focus is in an editable)
      if ((e.key === 'r' || e.key === 'R') && !e.altKey && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement | null
        if (target && (target.isContentEditable || /^(INPUT|TEXTAREA)$/.test(target.tagName))) {
          return
        }
        if (shortcutStateRef.current.canRegenerate) {
          e.preventDefault()
          shortcutStateRef.current.handleRegenerate()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Auto-scroll while streaming
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [content])

  // Push streaming state to main so the bubble window's blur handler knows
  // not to auto-close during an active stream.
  useEffect(() => {
    window.api.setSelectionBubbleStreaming(isStreaming)
  }, [isStreaming])

  // Cleanup listeners on unmount
  useEffect(() => {
    return () => {
      window.api.removeAllSelectionStreamListeners()
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    }
  }, [])

  const currentAction = useMemo<SelectionAction | null>(() => {
    if (!payload || !currentActionId) return null
    return payload.actions.find((a) => a.id === currentActionId) ?? null
  }, [payload, currentActionId])

  const isTranslate = currentAction?.id === BUILTIN_SEL_TRANSLATE_ID

  /**
   * Start streaming the current action against the current text+lang.
   * Caller is responsible for calling stop() on any in-flight request first.
   */
  const startRequest = useCallback(
    (action: SelectionAction, text: string, overrideLang?: string) => {
      window.api.removeAllSelectionStreamListeners()

      setContent('')
      setError(null)
      setIsStreaming(true)
      setCopySuccess(false)

      let systemPromptOverride: string | undefined
      if (action.id === BUILTIN_SEL_TRANSLATE_ID) {
        const lang = overrideLang ?? targetLangRef.current
        systemPromptOverride = generateTranslatePrompt(getLanguageEnglishLabel(lang))
      }

      let cleanedUp = false
      const cleanup = (): void => {
        if (cleanedUp) return
        cleanedUp = true
        unsubChunk()
        unsubEnd()
        unsubError()
      }
      const unsubChunk = window.api.onSelectionChunk((data) => {
        setContent((prev) => prev + data.delta)
      })
      const unsubEnd = window.api.onSelectionEnd(() => {
        setIsStreaming(false)
        cleanup()
      })
      const unsubError = window.api.onSelectionError((data) => {
        setError(data.error)
        setIsStreaming(false)
        cleanup()
      })

      window.api.selectionRequest({
        text,
        actionId: action.id,
        systemPromptOverride,
      })
    },
    [],
  )

  // Auto-run whenever a new payload arrives. Wait for targetLang to load so
  // the first translate doesn't fire with a stale UI-locale fallback.
  useEffect(() => {
    if (!payload || !currentAction) return
    if (!targetLangLoaded) return
    startRequest(currentAction, payload.text)
    // Only re-trigger when the payload itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, targetLangLoaded])

  const handleStop = useCallback(async () => {
    await window.api.stopSelectionRequest()
  }, [])

  const handleRegenerate = useCallback(async () => {
    if (!payload || !currentAction) return
    if (isStreaming) await window.api.stopSelectionRequest()
    startRequest(currentAction, payload.text)
  }, [payload, currentAction, isStreaming, startRequest])

  const handleSwitchAction = useCallback(
    async (nextActionId: string) => {
      if (!payload) return
      const next = payload.actions.find((a) => a.id === nextActionId)
      if (!next) return
      if (nextActionId === currentActionId) return
      if (isStreaming) await window.api.stopSelectionRequest()
      setCurrentActionId(nextActionId)
      startRequest(next, payload.text)
    },
    [payload, currentActionId, isStreaming, startRequest],
  )

  const handleTargetLangChange = useCallback(
    async (nextLang: string) => {
      if (nextLang === targetLang) return
      setTargetLang(nextLang)
      window.api.setSetting('selection.translateTargetLang', nextLang)
      if (!payload || !currentAction || currentAction.id !== BUILTIN_SEL_TRANSLATE_ID) return
      if (isStreaming) await window.api.stopSelectionRequest()
      startRequest(currentAction, payload.text, nextLang)
    },
    [targetLang, payload, currentAction, isStreaming, startRequest],
  )

  const handleTogglePin = useCallback(() => {
    const next = !pinned
    setPinned(next)
    window.api.setSelectionBubblePinned(next)
  }, [pinned])

  const handleCopy = useCallback(() => {
    if (!content) return
    navigator.clipboard
      .writeText(content)
      .then(() => {
        if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
        setCopySuccess(true)
        copyTimerRef.current = setTimeout(() => setCopySuccess(false), 1500)
      })
      .catch(() => {
        // Silently ignore clipboard failures
      })
  }, [content])

  const handleClose = useCallback(() => {
    window.api.selectionBubbleClose()
  }, [])

  // Keep the shortcut ref in sync with the latest state + handlers
  useEffect(() => {
    shortcutStateRef.current = {
      canRegenerate: !isStreaming && (Boolean(content) || Boolean(error)),
      canCopy: Boolean(content) && !isStreaming,
      handleRegenerate,
      handleCopy,
    }
  }, [isStreaming, content, error, handleRegenerate, handleCopy])

  return (
    <div className="flex h-screen flex-col">
      <div className="bg-background text-foreground flex h-full w-full flex-col overflow-hidden rounded-xl border">
        {/* Header: current action + window controls */}
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <ActionSelect
            actions={payload?.actions ?? []}
            currentId={currentActionId}
            onChange={handleSwitchAction}
            placeholder={t('settings.selectionAssistant.bubble.actionPlaceholder')}
          />
          {isTranslate && (
            <Select value={targetLang} onValueChange={handleTargetLangChange}>
              <SelectTrigger className="h-6 w-28 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex-1" />
          <button
            onClick={handleTogglePin}
            title={
              pinned
                ? t('settings.selectionAssistant.bubble.unpin')
                : t('settings.selectionAssistant.bubble.pin')
            }
            className="text-muted-foreground hover:text-foreground shrink-0 transition-colors">
            {pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={handleClose}
            title={t('settings.selectionAssistant.bubble.close')}
            className="text-muted-foreground hover:text-foreground shrink-0 transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Body: streaming markdown */}
        <div className="min-h-0 flex-1">
          <ScrollArea className="h-full">
            <div className="px-3 py-2 text-sm">
              {error ? (
                <div className="border-destructive/50 bg-destructive/10 rounded-md border p-2">
                  <p className="text-destructive text-xs">{resolveError(error)}</p>
                </div>
              ) : content ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <MarkdownRenderer content={content} />
                </div>
              ) : isStreaming ? (
                <div className="flex items-center gap-2 py-2">
                  <div className="bg-primary/60 h-2 w-2 animate-pulse rounded-full" />
                  <span className="text-muted-foreground text-xs">
                    {t('settings.selectionAssistant.bubble.generating')}
                  </span>
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>
        </div>

        {/* Footer: action buttons with inline shortcut hints */}
        <div className="text-muted-foreground flex items-center justify-between border-t px-3 py-1.5 text-xs">
          <div className="flex items-center gap-3">
            {isStreaming ? (
              <button
                onClick={handleStop}
                className="hover:text-foreground inline-flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors">
                <Square className="h-3 w-3" />
                {t('settings.selectionAssistant.bubble.stop')}
              </button>
            ) : (
              <>
                <button
                  onClick={handleRegenerate}
                  disabled={!content && !error}
                  className="hover:text-foreground inline-flex items-center rounded-md px-1 py-0.5 transition-colors disabled:opacity-40">
                  {t('settings.selectionAssistant.bubble.regenerate')}
                </button>
                <button
                  onClick={handleCopy}
                  disabled={!content}
                  className={`hover:text-foreground inline-flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors disabled:opacity-40 ${copySuccess ? 'text-green-500' : ''}`}>
                  {copySuccess && (
                    <svg
                      className="h-3 w-3"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                  {copySuccess
                    ? t('settings.selectionAssistant.bubble.copied')
                    : t('settings.selectionAssistant.bubble.copy')}
                </button>
              </>
            )}
          </div>
          <span>{t('settings.selectionAssistant.bubble.escToClose')}</span>
        </div>
      </div>
    </div>
  )
}

interface ActionSelectProps {
  actions: SelectionAction[]
  currentId: string
  onChange: (id: string) => void
  placeholder: string
}

function ActionSelect({
  actions,
  currentId,
  onChange,
  placeholder,
}: ActionSelectProps): React.JSX.Element {
  const st = useSeedTranslator()
  const current = actions.find((a) => a.id === currentId)
  const Icon = current
    ? (selectionActionIconMap[current.icon] ?? defaultSelectionActionIcon)
    : defaultSelectionActionIcon

  return (
    <Select value={currentId} onValueChange={onChange}>
      <SelectTrigger className="h-6 w-auto gap-1 border-none px-1.5 text-xs shadow-none focus:ring-0">
        <Icon className="h-3.5 w-3.5" />
        <span className="font-medium">{current ? st(current.name) : placeholder}</span>
      </SelectTrigger>
      <SelectContent position="popper">
        {actions.map((a) => {
          const ItemIcon = selectionActionIconMap[a.icon] ?? defaultSelectionActionIcon
          return (
            <SelectItem key={a.id} value={a.id}>
              <span className="flex items-center gap-2">
                <ItemIcon className="h-3.5 w-3.5" />
                <span>{st(a.name)}</span>
              </span>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
