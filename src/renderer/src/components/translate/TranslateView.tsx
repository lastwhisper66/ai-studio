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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { MarkdownRenderer } from '@renderer/components/chat/MarkdownRenderer'
import { useProviderStore } from '@renderer/stores/providerStore'
import { getTemplateByType } from '@renderer/components/settings/provider-templates'
import { TranslateSettingsDialog, type TranslateSettings } from './TranslateSettingsDialog'

interface Language {
  code: string
  label: string
}

const LANGUAGES: Language[] = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
]

export function TranslateView(): React.JSX.Element {
  const { t } = useTranslation()

  const SOURCE_LANGUAGES: Language[] = useMemo(
    () => [{ code: 'auto', label: t('translate.autoDetect') }, ...LANGUAGES],
    [t],
  )

  const [sourceText, setSourceText] = useState('')
  const [translatedText, setTranslatedText] = useState('')
  const [sourceLang, setSourceLang] = useState('auto')
  const [targetLang, setTargetLang] = useState('zh-CN')
  const [isTranslating, setIsTranslating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [translateSettings, setTranslateSettings] = useState<TranslateSettings>({
    systemPrompt: '',
    temperature: 0.3,
  })
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Independent model selection for translate (separate from chat's global selection)
  const providers = useProviderStore((s) => s.providers)
  const models = useProviderStore((s) => s.models)
  const globalProviderId = useProviderStore((s) => s.activeProviderId)
  const globalModelId = useProviderStore((s) => s.activeModelId)

  // Local override: null means "use global"
  const [localProviderId, setLocalProviderId] = useState<string | null>(null)
  const [localModelId, setLocalModelId] = useState<string | null>(null)

  // Load persisted translate settings on mount
  useEffect(() => {
    async function load(): Promise<void> {
      const [promptResult, tempResult, providerResult, modelResult] = await Promise.all([
        window.api.getSetting('translate.systemPrompt'),
        window.api.getSetting('translate.temperature'),
        window.api.getSetting('translate.providerId'),
        window.api.getSetting('translate.modelId'),
      ])
      setTranslateSettings({
        systemPrompt: promptResult.data ?? '',
        temperature: tempResult.data ? parseFloat(tempResult.data) : 0.3,
      })
      if (providerResult.data) setLocalProviderId(providerResult.data)
      if (modelResult.data) setLocalModelId(modelResult.data)
    }
    load()
  }, [])

  const activeProviderId = localProviderId ?? globalProviderId
  const activeModelId = localModelId ?? globalModelId
  const activeProvider = providers.find((p) => p.id === activeProviderId)
  const activeModel = activeModelId ? models.find((m) => m.id === activeModelId) : undefined
  const template = activeProvider ? getTemplateByType(activeProvider.type) : undefined
  const displayModel = activeModel?.name || activeProvider?.model || t('translate.noModelSelected')
  const enabledProviders = providers.filter((p) => p.enabled)

  const handleSelectModel = useCallback(
    (modelId: string, providerId: string) => {
      // If selecting same as global, clear local override
      if (modelId === globalModelId && providerId === globalProviderId) {
        setLocalProviderId(null)
        setLocalModelId(null)
        window.api.setSettingsBatch({
          'translate.providerId': '',
          'translate.modelId': '',
        })
      } else {
        setLocalProviderId(providerId)
        setLocalModelId(modelId)
        window.api.setSettingsBatch({
          'translate.providerId': providerId,
          'translate.modelId': modelId,
        })
      }
    },
    [globalProviderId, globalModelId],
  )

  // Register streaming listeners
  useEffect(() => {
    const unsubChunk = window.api.onTranslateChunk((data) => {
      setTranslatedText((prev) => prev + data.delta)
    })

    const unsubEnd = window.api.onTranslateEnd(() => {
      setIsTranslating(false)
    })

    const unsubError = window.api.onTranslateError((data) => {
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
    const text = sourceText.trim()
    if (!text || isTranslating) return

    setError(null)
    setTranslatedText('')
    setIsTranslating(true)

    const sourceLabel =
      sourceLang === 'auto'
        ? 'auto'
        : (SOURCE_LANGUAGES.find((l) => l.code === sourceLang)?.label ?? sourceLang)
    const targetLabel = LANGUAGES.find((l) => l.code === targetLang)?.label ?? targetLang

    const result = await window.api.translate({
      text,
      sourceLang: sourceLabel,
      targetLang: targetLabel,
      providerId: activeProviderId ?? undefined,
      modelId: activeModelId ?? undefined,
      systemPrompt: translateSettings.systemPrompt || undefined,
      temperature: translateSettings.temperature,
    })

    if (!result.success) {
      setError(result.error ?? t('translate.failed'))
      setIsTranslating(false)
    }
  }, [
    sourceText,
    sourceLang,
    targetLang,
    isTranslating,
    activeProviderId,
    activeModelId,
    translateSettings,
    t,
    SOURCE_LANGUAGES,
  ])

  const handleStop = useCallback(async () => {
    await window.api.stopTranslation()
    setIsTranslating(false)
  }, [])

  const handleSwapLanguages = useCallback(() => {
    if (sourceLang === 'auto') return
    setSourceLang(targetLang)
    setTargetLang(sourceLang)
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

  const handleClear = useCallback(() => {
    setSourceText('')
    setTranslatedText('')
    setError(null)
    textareaRef.current?.focus()
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
        <Select value={sourceLang} onValueChange={setSourceLang}>
          <SelectTrigger className="w-40" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
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

        <Select value={targetLang} onValueChange={setTargetLang}>
          <SelectTrigger className="w-40" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
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
          <Button size="sm" onClick={handleTranslate} disabled={!sourceText.trim()}>
            <Play className="mr-1.5 h-3.5 w-3.5" />
            {t('translate.translate')}
          </Button>
        )}

        <div className="flex-1" />

        {sourceText && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleClear}>
                <Eraser className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('translate.clear')}</TooltipContent>
          </Tooltip>
        )}

        {/* Model selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors hover:bg-muted">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: template?.color ?? '#6b7280' }}
              />
              <span className="max-w-30 truncate">{displayModel}</span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {enabledProviders.map((provider, index) => {
              const providerTemplate = getTemplateByType(provider.type)
              const providerModels = models.filter((m) => m.providerId === provider.id && m.enabled)
              return (
                <div key={provider.id}>
                  {index > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="flex items-center gap-1.5">
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: providerTemplate?.color ?? '#6b7280' }}
                      />
                      {provider.name}
                    </DropdownMenuLabel>
                    {providerModels.length > 0 ? (
                      providerModels.map((m) => {
                        const isSelected =
                          provider.id === activeProviderId && m.id === activeModelId
                        return (
                          <DropdownMenuItem
                            key={m.id}
                            onClick={() => handleSelectModel(m.id, provider.id)}>
                            <Check
                              className={`mr-2 h-3.5 w-3.5 ${isSelected ? '' : 'invisible'}`}
                            />
                            <span>{m.name}</span>
                          </DropdownMenuItem>
                        )
                      })
                    ) : (
                      <DropdownMenuItem disabled>
                        <span className="text-muted-foreground">
                          {t('translate.noModelConfigured')}
                        </span>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuGroup>
                </div>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>

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

      {/* Main content: source & result panels */}
      <div className="flex flex-1 overflow-hidden">
        {/* Source panel */}
        <div className="relative flex flex-1 flex-col border-r">
          <textarea
            ref={textareaRef}
            className="flex-1 resize-none bg-transparent p-4 text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
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
        <div className="flex flex-1 flex-col bg-muted/30">
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

          <ScrollArea className="flex-1">
            <div className="p-4">
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : translatedText ? (
                <div className="text-sm leading-relaxed">
                  <MarkdownRenderer content={translatedText} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {isTranslating ? t('translate.translating') : t('translate.resultPlaceholder')}
                </p>
              )}
            </div>
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
          })
        }}
      />
    </div>
  )
}
