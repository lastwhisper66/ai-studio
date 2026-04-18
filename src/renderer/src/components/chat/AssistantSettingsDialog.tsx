import { useState, useCallback, useEffect } from 'react'
import { RotateCcw, Save, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import i18n from '@renderer/i18n'
import { maybeTranslateSeed } from '@renderer/hooks/useSeedTranslator'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Textarea } from '@renderer/components/ui/textarea'
import { Switch } from '@renderer/components/ui/switch'
import { Slider } from '@renderer/components/ui/slider'
import { Separator } from '@renderer/components/ui/separator'
import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@renderer/components/ui/dialog'
import { useAssistantStore } from '@renderer/stores/assistantStore'
import { useProviderStore } from '@renderer/stores/providerStore'
import { getTemplateByType } from '@renderer/components/settings/provider-templates'
import { ModelPickerDialog } from './ModelPickerDialog'
import type { Assistant } from '@shared/types'
import { cn } from '@renderer/lib/utils'

interface AssistantSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  assistantId: string | null
  mode?: 'create' | 'edit'
  initialTab?: TabId
  onCreate?: (data: Partial<Assistant> & { name: string }) => void
}

type TabId = 'assistant' | 'model' | 'prompt'

interface FormState {
  name: string
  description: string
  providerId: string
  model: string
  temperature: string
  temperatureEnabled: boolean
  maxCompletionTokens: string
  maxCompletionTokensEnabled: boolean
  topP: string
  topPEnabled: boolean
  contextCount: string
  contextCountEnabled: boolean
  systemPrompt: string
  group: string
}

function defaultFormState(): FormState {
  return {
    name: '',
    description: '',
    providerId: '',
    model: '',
    temperature: '0.7',
    temperatureEnabled: false,
    maxCompletionTokens: '4096',
    maxCompletionTokensEnabled: false,
    topP: '1',
    topPEnabled: false,
    contextCount: '10',
    contextCountEnabled: true,
    systemPrompt: '',
    group: '',
  }
}

function stateFromAssistant(a: Assistant): FormState {
  const translateSeed = (v: string): string =>
    maybeTranslateSeed(v, (key, params) => i18n.t(key, params ?? {}) as string)
  return {
    name: translateSeed(a.name),
    description: translateSeed(a.description),
    providerId: a.providerId ?? '',
    model: a.model,
    temperature: a.temperature || '0.7',
    temperatureEnabled: a.temperature !== '',
    maxCompletionTokens: a.maxCompletionTokens || '4096',
    maxCompletionTokensEnabled: a.maxCompletionTokens !== '',
    topP: a.topP || '1',
    topPEnabled: a.topP !== '',
    contextCount: a.contextCount || '10',
    contextCountEnabled: a.contextCount !== '',
    systemPrompt: a.systemPrompt,
    group: a.group,
  }
}

export function AssistantSettingsDialog({
  open,
  onOpenChange,
  assistantId,
  mode = 'edit',
  initialTab,
  onCreate,
}: AssistantSettingsDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const { assistants, updateAssistant } = useAssistantStore()
  const providers = useProviderStore((s) => s.providers)

  const isCreateMode = mode === 'create'
  const assistant = assistants.find((a) => a.id === assistantId)
  const [activeTab, setActiveTab] = useState<TabId>('assistant')
  const [modelPickerOpen, setModelPickerOpen] = useState(false)
  const [form, setForm] = useState<FormState | null>(() =>
    isCreateMode ? defaultFormState() : assistant ? stateFromAssistant(assistant) : null,
  )

  // Re-sync form when the dialog opens or the assistant changes
  useEffect(() => {
    if (open) {
      if (isCreateMode) {
        setForm(defaultFormState()) // eslint-disable-line react-hooks/set-state-in-effect -- dialog open reset
      } else if (assistant) {
        setForm(stateFromAssistant(assistant))
      }
      setActiveTab(initialTab ?? 'assistant')
    }
  }, [open, assistantId, initialTab]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenChange = (nextOpen: boolean): void => {
    if (nextOpen) {
      if (isCreateMode) {
        setForm(defaultFormState())
      } else if (assistant) {
        setForm(stateFromAssistant(assistant))
      }
      setActiveTab(initialTab ?? 'assistant')
    }
    onOpenChange(nextOpen)
  }

  const commit = useCallback(
    (partial: Partial<Assistant>) => {
      if (isCreateMode) return // create mode: only update local form state
      if (!assistantId) return
      updateAssistant(assistantId, partial)
    },
    [isCreateMode, assistantId, updateAssistant],
  )

  // Model selector: compute display info from providerId + model
  const selectedProvider = form ? providers.find((p) => p.id === form.providerId) : undefined
  const selectedTemplate = selectedProvider ? getTemplateByType(selectedProvider.type) : undefined

  const isModelSelected = !!(form?.providerId && form?.model)

  if (!isCreateMode && (!assistant || !form)) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[70vw] h-[80vh]" />
      </Dialog>
    )
  }

  if (!form) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[70vw] h-[80vh]" />
      </Dialog>
    )
  }

  const change = (field: keyof FormState, value: string | boolean): void => {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev))
  }

  // Keep `seed.*` keys intact when the user didn't actually edit a display
  // value. `assistant` holds the original raw strings; we compare the form
  // value against its translated form and, if unchanged, commit the raw key.
  const sanitizeSeed = (field: 'name' | 'description', display: string): string => {
    if (!assistant) return display
    const raw = assistant[field]
    if (
      typeof raw === 'string' &&
      raw.startsWith('seed.') &&
      display === maybeTranslateSeed(raw, (k, p) => i18n.t(k, p ?? {}) as string)
    ) {
      return raw
    }
    return display
  }

  const handleBlur = (field: keyof FormState): void => {
    if (!form) return
    const value = form[field]
    switch (field) {
      case 'name':
        if (typeof value === 'string' && value.trim()) commit({ name: sanitizeSeed('name', value) })
        break
      case 'description':
        commit({ description: sanitizeSeed('description', value as string) })
        break
      case 'systemPrompt':
        commit({ systemPrompt: value as string })
        break
      case 'model':
        commit({ model: value as string })
        break
      case 'group':
        commit({ group: value as string })
        break
    }
  }

  const handleTemperatureToggle = (enabled: boolean): void => {
    change('temperatureEnabled', enabled)
    commit({ temperature: enabled ? form.temperature : '' })
  }

  const handleTemperatureCommit = (value: number): void => {
    const str = value.toString()
    change('temperature', str)
    commit({ temperature: str })
  }

  const handleMaxTokensToggle = (enabled: boolean): void => {
    change('maxCompletionTokensEnabled', enabled)
    commit({ maxCompletionTokens: enabled ? form.maxCompletionTokens : '' })
  }

  const handleMaxTokensCommit = (value: number): void => {
    const str = value.toString()
    change('maxCompletionTokens', str)
    commit({ maxCompletionTokens: str })
  }

  const handleTopPToggle = (enabled: boolean): void => {
    change('topPEnabled', enabled)
    commit({ topP: enabled ? form.topP : '' })
  }

  const handleTopPCommit = (value: number): void => {
    const str = value.toString()
    change('topP', str)
    commit({ topP: str })
  }

  const handleContextCountToggle = (enabled: boolean): void => {
    change('contextCountEnabled', enabled)
    commit({ contextCount: enabled ? form.contextCount : '' })
  }

  const handleContextCountCommit = (value: number): void => {
    const str = value.toString()
    change('contextCount', str)
    commit({ contextCount: str })
  }

  const handleSave = (): void => {
    if (isCreateMode) {
      onCreate?.({
        name: form.name.trim() || t('assistant.newAssistant'),
        description: form.description,
        providerId: form.providerId || null,
        model: form.model,
        temperature: form.temperatureEnabled ? form.temperature : '',
        maxCompletionTokens: form.maxCompletionTokensEnabled ? form.maxCompletionTokens : '',
        topP: form.topPEnabled ? form.topP : '',
        contextCount: form.contextCountEnabled ? form.contextCount : '',
        systemPrompt: form.systemPrompt,
        group: form.group,
      })
    } else {
      commit({
        name: sanitizeSeed('name', form.name),
        description: sanitizeSeed('description', form.description),
        providerId: form.providerId || null,
        model: form.model,
        temperature: form.temperatureEnabled ? form.temperature : '',
        maxCompletionTokens: form.maxCompletionTokensEnabled ? form.maxCompletionTokens : '',
        topP: form.topPEnabled ? form.topP : '',
        contextCount: form.contextCountEnabled ? form.contextCount : '',
        systemPrompt: form.systemPrompt,
        group: form.group,
      })
    }
    onOpenChange(false)
  }

  const handleReset = (): void => {
    if (isCreateMode) {
      setForm(defaultFormState())
      return
    }
    commit({
      providerId: null,
      model: '',
      temperature: '',
      maxCompletionTokens: '',
      topP: '',
      contextCount: '',
      systemPrompt: '',
    })
    setForm(
      stateFromAssistant({
        ...assistant!,
        providerId: null,
        model: '',
        temperature: '',
        maxCompletionTokens: '',
        topP: '',
        contextCount: '',
        systemPrompt: '',
      }),
    )
  }

  const temperatureValue = parseFloat(form.temperature) || 0.7
  const maxTokensValue = parseInt(form.maxCompletionTokens) || 4096
  const topPValue = parseFloat(form.topP) || 1
  const contextCountValue = parseInt(form.contextCount) || 10

  const tabs: { id: TabId; label: string }[] = [
    { id: 'assistant', label: t('assistant.settings.assistantTab') },
    { id: 'model', label: t('assistant.settings.modelTab') },
    { id: 'prompt', label: t('assistant.settings.promptTab') },
  ]

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[60vw] h-[70vh] flex flex-col p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>
            {isCreateMode ? t('assistant.settings.createTitle') : form.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1">
          {/* Left tab nav */}
          <div className="flex w-36 shrink-0 flex-col gap-0.5 border-r px-2 py-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={cn(
                  'rounded-md px-3 py-2 text-left text-sm transition-colors',
                  activeTab === tab.id
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                )}
                onClick={() => setActiveTab(tab.id)}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Right content */}
          <ScrollArea className="flex-1">
            <div className="space-y-4 p-5">
              {activeTab === 'assistant' && (
                <>
                  {/* Name */}
                  <div className="space-y-1.5">
                    <Label className="text-sm">{t('assistant.settings.name')}</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => change('name', e.target.value)}
                      onBlur={() => handleBlur('name')}
                      placeholder={t('assistant.settings.namePlaceholder')}
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <Label className="text-sm">{t('assistant.settings.description')}</Label>
                    <Input
                      value={form.description}
                      onChange={(e) => change('description', e.target.value)}
                      onBlur={() => handleBlur('description')}
                      placeholder={t('assistant.settings.descriptionPlaceholder')}
                    />
                  </div>

                  {/* Group */}
                  <div className="space-y-1.5">
                    <Label className="text-sm">{t('assistant.settings.group')}</Label>
                    <Input
                      value={form.group}
                      onChange={(e) => change('group', e.target.value)}
                      onBlur={() => handleBlur('group')}
                      placeholder={t('assistant.settings.groupPlaceholder')}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('assistant.settings.groupHint')}
                    </p>
                  </div>
                </>
              )}

              {activeTab === 'model' && (
                <>
                  {/* Model selector (grouped by provider) */}
                  <div className="space-y-1.5">
                    <Label className="text-sm">{t('assistant.settings.model')}</Label>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent"
                      onClick={() => setModelPickerOpen(true)}>
                      {form.providerId && form.model ? (
                        <>
                          <span
                            className="inline-block h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: selectedTemplate?.color ?? '#6b7280' }}
                          />
                          <span className="flex-1 truncate text-left">{form.model}</span>
                        </>
                      ) : (
                        <span className="flex-1 text-left text-muted-foreground">
                          {t('assistant.settings.selectModel')}
                        </span>
                      )}
                      <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
                    </button>
                    <ModelPickerDialog
                      open={modelPickerOpen}
                      onOpenChange={setModelPickerOpen}
                      selectedProviderId={form.providerId || null}
                      selectedModelId={form.model}
                      onSelect={(providerId, modelId) => {
                        change('providerId', providerId)
                        change('model', modelId)
                        commit({ providerId: providerId || null, model: modelId })
                      }}
                    />
                    {!isModelSelected && (
                      <p className="text-sm text-destructive">
                        {t('assistant.settings.modelRequired')}
                      </p>
                    )}
                  </div>

                  {/* Temperature */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{t('assistant.settings.temperature')}</span>
                      <div className="flex items-center gap-3">
                        {form.temperatureEnabled && (
                          <span className="font-mono text-xs text-muted-foreground">
                            {temperatureValue.toFixed(1)}
                          </span>
                        )}
                        <Switch
                          checked={form.temperatureEnabled}
                          onCheckedChange={handleTemperatureToggle}
                        />
                      </div>
                    </div>
                    {form.temperatureEnabled && (
                      <div>
                        <Slider
                          min={0}
                          max={2}
                          step={0.1}
                          value={[temperatureValue]}
                          onValueChange={([v]) => change('temperature', v.toString())}
                          onValueCommit={([v]) => handleTemperatureCommit(v)}
                        />
                        <div className="mt-1 flex justify-between px-0.5">
                          {['0', '0.5', '1.0', '1.5', '2.0'].map((mark) => (
                            <span key={mark} className="text-[11px] text-muted-foreground/50">
                              {mark}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Max Tokens */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{t('assistant.settings.maxTokens')}</span>
                      <div className="flex items-center gap-3">
                        {form.maxCompletionTokensEnabled && (
                          <span className="font-mono text-xs text-muted-foreground">
                            {maxTokensValue}
                          </span>
                        )}
                        <Switch
                          checked={form.maxCompletionTokensEnabled}
                          onCheckedChange={handleMaxTokensToggle}
                        />
                      </div>
                    </div>
                    {form.maxCompletionTokensEnabled && (
                      <div>
                        <Slider
                          min={256}
                          max={128000}
                          step={256}
                          value={[maxTokensValue]}
                          onValueChange={([v]) => change('maxCompletionTokens', v.toString())}
                          onValueCommit={([v]) => handleMaxTokensCommit(v)}
                        />
                        <div className="mt-1 flex justify-between px-0.5">
                          {['256', '32K', '64K', '96K', '128K'].map((mark) => (
                            <span key={mark} className="text-[11px] text-muted-foreground/50">
                              {mark}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Top P */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{t('assistant.settings.topP')}</span>
                      <div className="flex items-center gap-3">
                        {form.topPEnabled && (
                          <span className="font-mono text-xs text-muted-foreground">
                            {topPValue.toFixed(2)}
                          </span>
                        )}
                        <Switch checked={form.topPEnabled} onCheckedChange={handleTopPToggle} />
                      </div>
                    </div>
                    {form.topPEnabled && (
                      <div>
                        <Slider
                          min={0}
                          max={1}
                          step={0.05}
                          value={[topPValue]}
                          onValueChange={([v]) => change('topP', v.toString())}
                          onValueCommit={([v]) => handleTopPCommit(v)}
                        />
                        <div className="mt-1 flex justify-between px-0.5">
                          {['0', '0.25', '0.5', '0.75', '1.0'].map((mark) => (
                            <span key={mark} className="text-[11px] text-muted-foreground/50">
                              {mark}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Context Count */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{t('assistant.settings.contextCount')}</span>
                      <div className="flex items-center gap-3">
                        {form.contextCountEnabled && (
                          <span className="font-mono text-xs text-muted-foreground">
                            {contextCountValue}
                          </span>
                        )}
                        <Switch
                          checked={form.contextCountEnabled}
                          onCheckedChange={handleContextCountToggle}
                        />
                      </div>
                    </div>
                    {form.contextCountEnabled && (
                      <div>
                        <Slider
                          min={0}
                          max={50}
                          step={1}
                          value={[contextCountValue]}
                          onValueChange={([v]) => change('contextCount', v.toString())}
                          onValueCommit={([v]) => handleContextCountCommit(v)}
                        />
                        <div className="mt-1 flex justify-between px-0.5">
                          {['0', '10', '20', '30', '40', '50'].map((mark) => (
                            <span key={mark} className="text-[11px] text-muted-foreground/50">
                              {mark}
                            </span>
                          ))}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t('assistant.settings.contextCountHint')}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {activeTab === 'prompt' && (
                <>
                  {/* System Prompt */}
                  <div className="space-y-1.5">
                    <Label className="text-sm">{t('assistant.settings.systemPrompt')}</Label>
                    <Textarea
                      rows={14}
                      value={form.systemPrompt}
                      onChange={(e) => change('systemPrompt', e.target.value)}
                      onBlur={() => handleBlur('systemPrompt')}
                      placeholder={t('assistant.settings.systemPromptPlaceholder')}
                      className="max-h-96 resize-y"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('assistant.settings.systemPromptHint')}
                    </p>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t px-6 py-3">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            {t('assistant.settings.resetButton')}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isCreateMode && !isModelSelected}>
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {t('assistant.settings.saveButton')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
