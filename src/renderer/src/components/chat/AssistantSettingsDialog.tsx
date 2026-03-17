import { useState, useCallback } from 'react'
import { RotateCcw } from 'lucide-react'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Textarea } from '@renderer/components/ui/textarea'
import { Switch } from '@renderer/components/ui/switch'
import { Slider } from '@renderer/components/ui/slider'
import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@renderer/components/ui/dialog'
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
  emoji: string
  description: string
  providerId: string
  model: string
  temperature: string
  temperatureEnabled: boolean
  maxCompletionTokens: string
  maxCompletionTokensEnabled: boolean
  systemPrompt: string
  group: string
}

function stateFromAssistant(a: Assistant): FormState {
  return {
    name: a.name,
    emoji: a.emoji,
    description: a.description,
    providerId: a.providerId ?? '',
    model: a.model,
    temperature: a.temperature || '0.7',
    temperatureEnabled: a.temperature !== '',
    maxCompletionTokens: a.maxCompletionTokens || '4096',
    maxCompletionTokensEnabled: a.maxCompletionTokens !== '',
    systemPrompt: a.systemPrompt,
    group: a.group,
  }
}

export function AssistantSettingsDialog({
  open,
  onOpenChange,
  assistantId,
}: AssistantSettingsDialogProps): React.JSX.Element {
  const { assistants, updateAssistant } = useAssistantStore()
  const providers = useProviderStore((s) => s.providers)

  const assistant = assistants.find((a) => a.id === assistantId)
  const [activeTab, setActiveTab] = useState<TabId>('model')
  const [form, setForm] = useState<FormState | null>(() =>
    assistant ? stateFromAssistant(assistant) : null,
  )

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

  if (!assistant || !form) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl" />
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
      case 'emoji':
        commit({ emoji: (value as string) || '🤖' })
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
      case 'providerId':
        commit({ providerId: (value as string) || null })
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

  const handleReset = (): void => {
    commit({
      providerId: null,
      model: '',
      temperature: '',
      maxCompletionTokens: '',
      systemPrompt: '',
    })
    setForm(
      stateFromAssistant({
        ...assistant,
        providerId: null,
        model: '',
        temperature: '',
        maxCompletionTokens: '',
        systemPrompt: '',
      }),
    )
  }

  const enabledProviders = providers.filter((p) => p.enabled)
  const temperatureValue = parseFloat(form.temperature) || 0.7
  const maxTokensValue = parseInt(form.maxCompletionTokens) || 4096

  const tabs: { id: TabId; label: string }[] = [
    { id: 'model', label: '模型设置' },
    { id: 'prompt', label: '提示词设置' },
  ]

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <span className="text-lg">{form.emoji}</span>
            <span>{form.name}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex min-h-[400px]">
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
                  {/* Provider */}
                  <div className="space-y-1.5">
                    <Label className="text-sm">模型服务</Label>
                    <select
                      value={form.providerId}
                      onChange={(e) => {
                        change('providerId', e.target.value)
                        commit({ providerId: e.target.value || null })
                      }}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                      <option value="">使用默认</option>
                      {enabledProviders.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Model */}
                  <div className="space-y-1.5">
                    <Label className="text-sm">模型名</Label>
                    <Input
                      value={form.model}
                      onChange={(e) => change('model', e.target.value)}
                      onBlur={() => handleBlur('model')}
                      placeholder="留空使用服务商默认模型"
                    />
                  </div>

                  {/* Temperature */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">模型温度</span>
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
                      <span className="text-sm">最大 Token 数</span>
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
                </>
              )}

              {activeTab === 'prompt' && (
                <>
                  {/* Name / Emoji */}
                  <div className="flex gap-3">
                    <div className="w-20 space-y-1.5">
                      <Label className="text-sm">图标</Label>
                      <Input
                        value={form.emoji}
                        onChange={(e) => change('emoji', e.target.value)}
                        onBlur={() => handleBlur('emoji')}
                        className="text-center text-lg"
                        maxLength={2}
                      />
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <Label className="text-sm">名称</Label>
                      <Input
                        value={form.name}
                        onChange={(e) => change('name', e.target.value)}
                        onBlur={() => handleBlur('name')}
                        placeholder="助手名称"
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <Label className="text-sm">描述</Label>
                    <Input
                      value={form.description}
                      onChange={(e) => change('description', e.target.value)}
                      onBlur={() => handleBlur('description')}
                      placeholder="简要描述助手的用途..."
                    />
                  </div>

                  {/* Group */}
                  <div className="space-y-1.5">
                    <Label className="text-sm">分组</Label>
                    <Input
                      value={form.group}
                      onChange={(e) => change('group', e.target.value)}
                      onBlur={() => handleBlur('group')}
                      placeholder={'输入分组名称，如「翻译」、「编程」'}
                    />
                    <p className="text-xs text-muted-foreground">
                      填写分组名称后，助手将按分组折叠显示在侧边栏中。留空则不分组。
                    </p>
                  </div>

                  {/* System Prompt */}
                  <div className="space-y-1.5">
                    <Label className="text-sm">系统提示词</Label>
                    <Textarea
                      rows={8}
                      value={form.systemPrompt}
                      onChange={(e) => change('systemPrompt', e.target.value)}
                      onBlur={() => handleBlur('systemPrompt')}
                      placeholder="设定助手的角色和行为..."
                    />
                    <p className="text-xs text-muted-foreground">
                      定义助手的角色、能力和行为规则。留空则使用全局系统提示词。
                    </p>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t px-6 py-3">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            重置
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
