import { useState, useCallback, useEffect, useMemo } from 'react'
import { RotateCcw, Save } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Textarea } from '@renderer/components/ui/textarea'
import { Switch } from '@renderer/components/ui/switch'
import { Slider } from '@renderer/components/ui/slider'
import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@renderer/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'
import { useAssistantStore } from '@renderer/stores/assistantStore'
import { useProviderStore } from '@renderer/stores/providerStore'
import type { Assistant } from '@shared/types'
import { cn } from '@renderer/lib/utils'

interface AssistantSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  assistantId: string | null
}

type TabId = 'model' | 'prompt'

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

function stateFromAssistant(a: Assistant): FormState {
  return {
    name: a.name,
    description: a.description,
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
}: AssistantSettingsDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const { assistants, updateAssistant } = useAssistantStore()
  const providers = useProviderStore((s) => s.providers)
  const models = useProviderStore((s) => s.models)

  const assistant = assistants.find((a) => a.id === assistantId)
  const [activeTab, setActiveTab] = useState<TabId>('model')
  const [form, setForm] = useState<FormState | null>(() =>
    assistant ? stateFromAssistant(assistant) : null,
  )

  // Re-sync form when the dialog opens or the assistant changes
  useEffect(() => {
    if (open && assistant) {
      setForm(stateFromAssistant(assistant))
      setActiveTab('model')
    }
  }, [open, assistantId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenChange = (nextOpen: boolean): void => {
    if (nextOpen && assistant) {
      setForm(stateFromAssistant(assistant))
      setActiveTab('model')
    }
    onOpenChange(nextOpen)
  }

  const commit = useCallback(
    (partial: Partial<Assistant>) => {
      if (!assistantId) return
      updateAssistant(assistantId, partial)
    },
    [assistantId, updateAssistant],
  )

  // Model selector: compute the select value from providerId + model
  const enabledProviders = providers.filter((p) => p.enabled)

  const modelSelectValue = useMemo(() => {
    if (!form) return '__default__'
    if (!form.providerId && !form.model) return '__default__'
    if (form.providerId && form.model) return `${form.providerId}::${form.model}`
    if (form.providerId) return `${form.providerId}::`
    return '__default__'
  }, [form?.providerId, form?.model]) // eslint-disable-line react-hooks/exhaustive-deps

  // Check if the current model is a known model in the list (for custom model input display)
  const isKnownModel = useMemo(() => {
    if (!form?.providerId || !form?.model) return true
    return models.some(
      (m) => m.providerId === form.providerId && m.name === form.model && m.enabled,
    )
  }, [form?.providerId, form?.model, models])

  if (!assistant || !form) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[70vw] h-[80vh]" />
      </Dialog>
    )
  }

  const change = (field: keyof FormState, value: string | boolean): void => {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev))
  }

  const handleBlur = (field: keyof FormState): void => {
    if (!form) return
    const value = form[field]
    switch (field) {
      case 'name':
        if (typeof value === 'string' && value.trim()) commit({ name: value })
        break
      case 'description':
        commit({ description: value as string })
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

  const handleModelSelect = (val: string): void => {
    if (val === '__default__') {
      change('providerId', '')
      change('model', '')
      commit({ providerId: null, model: '' })
    } else {
      const sepIndex = val.indexOf('::')
      const providerId = val.slice(0, sepIndex)
      const modelName = val.slice(sepIndex + 2)
      change('providerId', providerId)
      change('model', modelName)
      commit({ providerId: providerId || null, model: modelName })
    }
  }

  const handleSave = (): void => {
    commit({
      name: form.name,
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
    onOpenChange(false)
  }

  const handleReset = (): void => {
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
        ...assistant,
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
    { id: 'model', label: t('assistant.settings.modelTab') },
    { id: 'prompt', label: t('assistant.settings.promptTab') },
  ]

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[60vw] h-[70vh] flex flex-col p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{form.name}</DialogTitle>
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
              {activeTab === 'model' && (
                <>
                  {/* Model selector (grouped by provider) */}
                  <div className="space-y-1.5">
                    <Label className="text-sm">{t('assistant.settings.model')}</Label>
                    {enabledProviders.length === 0 ? (
                      <p className="text-sm text-muted-foreground rounded-md border border-dashed px-3 py-2">
                        {t('assistant.settings.noProviderHint')}
                      </p>
                    ) : (
                      <Select value={modelSelectValue} onValueChange={handleModelSelect}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__default__">
                            {t('assistant.settings.useDefault')}
                          </SelectItem>
                          {enabledProviders.map((provider) => {
                            const providerModels = models.filter(
                              (m) => m.providerId === provider.id && m.enabled,
                            )
                            return (
                              <SelectGroup key={provider.id}>
                                <SelectLabel>{provider.name}</SelectLabel>
                                {providerModels.map((m) => (
                                  <SelectItem key={m.id} value={`${provider.id}::${m.name}`}>
                                    {m.name}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Custom model name input (shown when a provider is selected) */}
                  {form.providerId && (
                    <div className="space-y-1.5">
                      <Label className="text-sm">{t('assistant.settings.customModelName')}</Label>
                      <Input
                        value={isKnownModel ? '' : form.model}
                        onChange={(e) => {
                          change('model', e.target.value)
                        }}
                        onBlur={() => handleBlur('model')}
                        placeholder={t('assistant.settings.customModelPlaceholder')}
                      />
                      <p className="text-xs text-muted-foreground">
                        {t('assistant.settings.customModelHint')}
                      </p>
                    </div>
                  )}

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

                  {/* System Prompt */}
                  <div className="space-y-1.5">
                    <Label className="text-sm">{t('assistant.settings.systemPrompt')}</Label>
                    <Textarea
                      rows={8}
                      value={form.systemPrompt}
                      onChange={(e) => change('systemPrompt', e.target.value)}
                      onBlur={() => handleBlur('systemPrompt')}
                      placeholder={t('assistant.settings.systemPromptPlaceholder')}
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
          <Button size="sm" onClick={handleSave}>
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {t('assistant.settings.saveButton')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
