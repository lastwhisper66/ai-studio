import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  ArrowRightLeft,
  Copy,
  Check,
  Play,
  Square,
  Eraser,
  Settings2,
  ChevronDown,
  X,
  Trash2,
  History,
  WrapText,
  FileText,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@renderer/components/ui/dialog'
import { MarkdownRenderer } from '@renderer/components/chat/MarkdownRenderer'
import { ModelPickerDialog } from '@renderer/components/chat/ModelPickerDialog'
import { useProviderStore } from '@renderer/stores/providerStore'
import { getTemplateByType } from '@renderer/components/settings/provider-templates'
import { TranslateSettingsDialog, type TranslateSettings } from './TranslateSettingsDialog'
import { LANGUAGES, type Language } from '@renderer/lib/languages'
import type { TranslationHistoryItem } from '@shared/types'
import type { LocalizedError } from '@shared/errors'
import { useLocalizedError } from '@renderer/hooks/useLocalizedError'

const TRANSLATE_TAG_RE = /<\/?translate_input>\n?/g

export function TranslateView(): React.JSX.Element {
  const { t } = useTranslation()
  const resolveError = useLocalizedError()

  const SOURCE_LANGUAGES: Language[] = useMemo(
    () => [
      { code: 'auto', label: t('translate.autoDetect'), englishLabel: 'Auto Detect' },
      ...LANGUAGES,
    ],
    [t],
  )

  const [sourceText, setSourceText] = useState('')
  const [translatedText, setTranslatedText] = useState('')
  const [sourceLang, setSourceLang] = useState('auto')
  const [targetLang, setTargetLang] = useState('zh-CN')
  const [isTranslating, setIsTranslating] = useState(false)
  const [error, setError] = useState<LocalizedError | string | null>(null)
  const [copied, setCopied] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [modelPickerOpen, setModelPickerOpen] = useState(false)
  const [translateSettings, setTranslateSettings] = useState<TranslateSettings>({
    systemPrompt: '',
    temperature: 0.3,
    wordWrap: true,
    markdownPreview: false,
  })
  const [history, setHistory] = useState<TranslationHistoryItem[]>([])
  const [clearHistoryOpen, setClearHistoryOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const currentTranslationRef = useRef<{
    requestId: number
    sourceText: string
    sourceLang: string
    targetLang: string
  } | null>(null)
  const sessionIdRef = useRef(0)

  // Independent model selection for translate (separate from chat's global selection)
  const providers = useProviderStore((s) => s.providers)
  const models = useProviderStore((s) => s.models)

  // Local model selection (user must pick explicitly)
  const [localProviderId, setLocalProviderId] = useState<string | null>(null)
  const [localModelId, setLocalModelId] = useState<string | null>(null)

  // Load persisted translate settings on mount
  useEffect(() => {
    async function load(): Promise<void> {
      const [
        promptResult,
        tempResult,
        providerResult,
        modelResult,
        srcLangResult,
        tgtLangResult,
        wordWrapResult,
        markdownPreviewResult,
      ] = await Promise.all([
        window.api.getSetting('translate.systemPrompt'),
        window.api.getSetting('translate.temperature'),
        window.api.getSetting('translate.providerId'),
        window.api.getSetting('translate.modelId'),
        window.api.getSetting('translate.sourceLang'),
        window.api.getSetting('translate.targetLang'),
        window.api.getSetting('translate.wordWrap'),
        window.api.getSetting('translate.markdownPreview'),
      ])
      setTranslateSettings({
        systemPrompt: promptResult.data ?? '',
        temperature: tempResult.data ? parseFloat(tempResult.data) : 0.3,
        wordWrap: wordWrapResult.data !== 'false',
        markdownPreview: markdownPreviewResult.data === 'true',
      })
      if (providerResult.data) setLocalProviderId(providerResult.data)
      if (modelResult.data) setLocalModelId(modelResult.data)
      if (srcLangResult.data) setSourceLang(srcLangResult.data)
      if (tgtLangResult.data) setTargetLang(tgtLangResult.data)
    }
    load()
  }, [])

  // Load translation history on mount
  useEffect(() => {
    window.api.listTranslationHistory().then((result) => {
      if (result.success && result.data) setHistory(result.data)
    })
  }, [])

  // Persist language selection changes
  const handleSourceLangChange = useCallback((value: string) => {
    setSourceLang(value)
    window.api.setSetting('translate.sourceLang', value)
  }, [])

  const resolveSourceLabel = useCallback(
    (lang: string) =>
      lang === 'auto' ? 'auto' : (LANGUAGES.find((l) => l.code === lang)?.englishLabel ?? lang),
    [],
  )

  const doTranslate = useCallback(
    async (text: string, srcLang: string, tgtLang: string) => {
      currentTranslationRef.current = null
      await window.api.stopTranslation()

      const id = ++sessionIdRef.current
      setError(null)
      setTranslatedText('')
      setIsTranslating(true)

      const sourceLabel = resolveSourceLabel(srcLang)
      const targetLabel = LANGUAGES.find((l) => l.code === tgtLang)?.englishLabel ?? tgtLang

      currentTranslationRef.current = {
        requestId: id,
        sourceText: text,
        sourceLang: sourceLabel,
        targetLang: targetLabel,
      }

      const result = await window.api.translate({
        requestId: id,
        text,
        sourceLang: sourceLabel,
        targetLang: targetLabel,
        providerId: localProviderId ?? undefined,
        modelId: localModelId ?? undefined,
        systemPrompt: translateSettings.systemPrompt || undefined,
        temperature: translateSettings.temperature,
      })

      if (sessionIdRef.current !== id) return
      if (!result.success) {
        setError(result.error ?? t('translate.failed'))
        setIsTranslating(false)
        currentTranslationRef.current = null
      }
    },
    [resolveSourceLabel, localProviderId, localModelId, translateSettings, t],
  )

  const handleTargetLangChange = useCallback(
    (value: string) => {
      setTargetLang(value)
      window.api.setSetting('translate.targetLang', value)

      const text = sourceText
      if (!text.trim()) return

      doTranslate(text, sourceLang, value).catch(() => {})
    },
    [sourceText, sourceLang, doTranslate],
  )

  const activeProviderId = localProviderId
  const activeModelId = localModelId
  const activeProvider = providers.find((p) => p.id === activeProviderId)
  const activeModel = activeModelId ? models.find((m) => m.id === activeModelId) : undefined
  const template = activeProvider ? getTemplateByType(activeProvider.type) : undefined
  const displayModel = activeModel?.name || t('translate.noModelSelected')

  const handleSelectModel = useCallback((modelId: string, providerId: string) => {
    setLocalProviderId(providerId)
    setLocalModelId(modelId)
    window.api.setSettingsBatch({
      'translate.providerId': providerId,
      'translate.modelId': modelId,
    })
  }, [])

  // Register streaming listeners
  useEffect(() => {
    const unsubChunk = window.api.onTranslateChunk((data) => {
      if (data.requestId !== currentTranslationRef.current?.requestId) return
      const cleaned = data.delta.replace(TRANSLATE_TAG_RE, '')
      if (cleaned) setTranslatedText((prev) => prev + cleaned)
    })

    const unsubEnd = window.api.onTranslateEnd((data) => {
      const params = currentTranslationRef.current
      if (!params || data.requestId !== params.requestId) return
      currentTranslationRef.current = null
      setIsTranslating(false)
      const cleanedFull = data.fullText?.replace(TRANSLATE_TAG_RE, '') || ''
      if (cleanedFull) {
        setTranslatedText(cleanedFull)
        window.api
          .createTranslationHistory(
            params.sourceText,
            data.fullText,
            params.sourceLang,
            params.targetLang,
          )
          .then((result) => {
            if (result.success && result.data) {
              setHistory((prev) => [result.data!, ...prev].slice(0, 50))
            }
          })
      }
    })

    const unsubError = window.api.onTranslateError((data) => {
      if (data.requestId !== currentTranslationRef.current?.requestId) return
      currentTranslationRef.current = null
      setError(data.error)
      setIsTranslating(false)
    })

    return () => {
      unsubChunk()
      unsubEnd()
      unsubError()
      window.api.removeAllTranslateListeners()
    }
  }, [])

  const handleTranslate = useCallback(async () => {
    const text = sourceText
    if (!text.trim() || isTranslating) return

    await doTranslate(text, sourceLang, targetLang)
  }, [sourceText, sourceLang, targetLang, isTranslating, doTranslate])

  const handleStop = useCallback(async () => {
    currentTranslationRef.current = null
    await window.api.stopTranslation()
    setIsTranslating(false)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && isTranslating) {
        handleStop()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isTranslating, handleStop])

  const handleSwapLanguages = useCallback(() => {
    if (sourceLang === 'auto') return
    const newSource = targetLang
    const newTarget = sourceLang
    setSourceLang(newSource)
    setTargetLang(newTarget)
    window.api.setSettingsBatch({
      'translate.sourceLang': newSource,
      'translate.targetLang': newTarget,
    })
    if (translatedText) {
      setSourceText(translatedText)
      setTranslatedText(sourceText)
    }
  }, [sourceLang, targetLang, sourceText, translatedText])

  const handleCopy = useCallback(async () => {
    if (!translatedText) return
    await navigator.clipboard.writeText(translatedText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [translatedText])

  const handleToggleWordWrap = useCallback(() => {
    const next = !translateSettings.wordWrap
    setTranslateSettings((prev) => ({ ...prev, wordWrap: next }))
    window.api.setSetting('translate.wordWrap', String(next))
  }, [translateSettings.wordWrap])

  const handleToggleMarkdownPreview = useCallback(() => {
    const next = !translateSettings.markdownPreview
    setTranslateSettings((prev) => ({ ...prev, markdownPreview: next }))
    window.api.setSetting('translate.markdownPreview', String(next))
  }, [translateSettings.markdownPreview])

  const handleClear = useCallback(() => {
    setSourceText('')
    setTranslatedText('')
    setError(null)
    textareaRef.current?.focus()
  }, [])

  const handleClearInput = useCallback(() => {
    setSourceText('')
    textareaRef.current?.focus()
  }, [])

  const handleClearHistory = useCallback(async () => {
    await window.api.clearTranslationHistory()
    setHistory([])
    setClearHistoryOpen(false)
  }, [])

  const handleHistoryItemClick = useCallback((item: TranslationHistoryItem) => {
    setSourceText(item.sourceText)
    setTranslatedText(item.translatedText)
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleTranslate()
      }
    },
    [handleTranslate],
  )

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <Select value={sourceLang} onValueChange={handleSourceLangChange}>
          <SelectTrigger className="w-40" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" side="bottom">
            {SOURCE_LANGUAGES.map((lang) => (
              <SelectItem key={lang.code} value={lang.code}>
                {lang.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleSwapLanguages}
              disabled={sourceLang === 'auto'}>
              <ArrowRightLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('translate.swapLanguages')}</TooltipContent>
        </Tooltip>

        <Select value={targetLang} onValueChange={handleTargetLangChange}>
          <SelectTrigger className="w-40" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" side="bottom">
            {LANGUAGES.map((lang) => (
              <SelectItem key={lang.code} value={lang.code}>
                {lang.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isTranslating ? (
          <Button variant="destructive" size="sm" onClick={handleStop}>
            <Square className="mr-1.5 h-3.5 w-3.5" />
            {t('translate.stop')}
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleTranslate}
            disabled={!sourceText.trim() || !activeModelId}>
            <Play className="mr-1.5 h-3.5 w-3.5" />
            {t('translate.translate')}
          </Button>
        )}

        <div className="flex-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleClear}>
              <Eraser className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('translate.clear')}</TooltipContent>
        </Tooltip>

        <div className="h-5 w-px bg-border" aria-hidden="true" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 ${
                translateSettings.wordWrap ? 'bg-accent text-accent-foreground' : ''
              }`}
              onClick={handleToggleWordWrap}
              aria-label={t('translate.settings.wordWrap')}>
              <WrapText className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('translate.settings.wordWrap')}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 ${
                translateSettings.markdownPreview ? 'bg-accent text-accent-foreground' : ''
              }`}
              onClick={handleToggleMarkdownPreview}
              aria-label={t('translate.settings.markdownPreview')}>
              <FileText className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('translate.settings.markdownPreview')}</TooltipContent>
        </Tooltip>

        <div className="h-5 w-px bg-border" aria-hidden="true" />

        {/* Model selector */}
        <button
          className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors hover:bg-muted"
          onClick={() => setModelPickerOpen(true)}>
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: template?.color ?? '#6b7280' }}
          />
          <span className="max-w-100 truncate">{displayModel}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </button>
        <ModelPickerDialog
          open={modelPickerOpen}
          onOpenChange={setModelPickerOpen}
          selectedProviderId={activeProviderId ?? null}
          selectedModelId={activeModel?.name ?? ''}
          onSelect={(providerId, modelId) => {
            const model = models.find((m) => m.providerId === providerId && m.name === modelId)
            if (model) handleSelectModel(model.id, providerId)
          }}
        />

        {/* Settings button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSettingsOpen(true)}>
              <Settings2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('translate.settings.title')}</TooltipContent>
        </Tooltip>
      </div>

      {/* Main content: source & result & history panels */}
      <div className="flex flex-1 overflow-hidden">
        {/* Source panel */}
        <div className="relative flex min-w-0 flex-1 flex-col border-r">
          {sourceText && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="absolute right-5 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-muted/80 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  onClick={handleClearInput}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t('translate.history.clearInput')}</TooltipContent>
            </Tooltip>
          )}
          <textarea
            ref={textareaRef}
            className="flex-1 resize-none bg-transparent p-4 pr-10 text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
            placeholder={t('translate.inputPlaceholder')}
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isTranslating}
          />
          <div className="flex items-center justify-end px-4 py-1 text-xs text-muted-foreground">
            {sourceText.length.toLocaleString()}
          </div>
        </div>

        {/* Result panel */}
        <div className="flex min-w-0 flex-1 flex-col bg-muted/30">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <span className="text-sm font-medium text-muted-foreground">
              {t('translate.result')}
            </span>
            {translatedText && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {copied ? t('translate.copied') : t('translate.copyTranslation')}
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            <div
              className={`p-4 ${
                translateSettings.wordWrap
                  ? 'min-w-0 translate-result-wrap'
                  : 'w-max min-w-full translate-result-nowrap'
              }`}>
              {error ? (
                <p className="text-sm text-destructive">{resolveError(error)}</p>
              ) : translatedText ? (
                translateSettings.markdownPreview ? (
                  <div className="translate-result-markdown text-sm leading-relaxed">
                    <MarkdownRenderer content={translatedText} isStreaming={isTranslating} />
                  </div>
                ) : (
                  <div className="translate-plain text-sm leading-relaxed">{translatedText}</div>
                )
              ) : (
                <p className="text-sm text-muted-foreground">
                  {isTranslating ? t('translate.translating') : t('translate.resultPlaceholder')}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* History panel */}
        <div className="flex w-64 flex-col border-l">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <History className="h-3.5 w-3.5" />
              {t('translate.history.title')}
            </span>
            {history.length > 0 && (
              <Dialog open={clearHistoryOpen} onOpenChange={setClearHistoryOpen}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </DialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent>{t('translate.history.clearHistory')}</TooltipContent>
                </Tooltip>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('translate.history.clearHistory')}</DialogTitle>
                    <DialogDescription>
                      {t('translate.history.clearHistoryConfirm')}
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setClearHistoryOpen(false)}>
                      {t('common.cancel')}
                    </Button>
                    <Button variant="destructive" onClick={handleClearHistory}>
                      {t('common.confirm')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
          <ScrollArea className="flex-1">
            {history.length === 0 ? (
              <div className="flex h-full items-center justify-center p-4">
                <p className="text-sm text-muted-foreground">{t('translate.history.empty')}</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {history.map((item) => (
                  <button
                    key={item.id}
                    className="border-b px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
                    onClick={() => handleHistoryItemClick(item)}>
                    <div className="mb-1 text-xs text-muted-foreground">
                      {item.sourceLang} → {item.targetLang}
                    </div>
                    <div className="line-clamp-2 text-sm">{item.sourceText}</div>
                    <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                      {item.translatedText}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* Settings dialog */}
      <TranslateSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={translateSettings}
        onSave={(s) => {
          setTranslateSettings(s)
          window.api.setSettingsBatch({
            'translate.systemPrompt': s.systemPrompt,
            'translate.temperature': String(s.temperature),
            'translate.wordWrap': String(s.wordWrap),
            'translate.markdownPreview': String(s.markdownPreview),
          })
        }}
      />
    </div>
  )
}
