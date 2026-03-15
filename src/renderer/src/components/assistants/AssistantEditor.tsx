import { useState, useEffect, useCallback } from 'react'
import { Trash2, Plus, X } from 'lucide-react'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Textarea } from '@renderer/components/ui/textarea'
import { Switch } from '@renderer/components/ui/switch'
import { Slider } from '@renderer/components/ui/slider'
import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { useAssistantStore } from '@renderer/stores/assistantStore'
import { useProviderStore } from '@renderer/stores/providerStore'
import type { Assistant } from '@shared/types'

export function AssistantEditor(): React.JSX.Element {
  const { assistants, selectedAssistantId } = useAssistantStore()
  const assistant = assistants.find((a) => a.id === selectedAssistantId)

  if (!assistant) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        请选择一个助手或创建新助手
      </div>
    )
  }

  return <AssistantForm key={assistant.id} assistant={assistant} />
}

interface AssistantFormState {
  name: string
  description: string
  emoji: string
  systemPrompt: string
  providerId: string
  model: string
  temperature: string
  temperatureEnabled: boolean
  maxTokens: string
  maxTokensEnabled: boolean
  promptSuggestions: string[]
}

function stateFromAssistant(a: Assistant): AssistantFormState {
  return {
    name: a.name,
    description: a.description,
    emoji: a.emoji,
    systemPrompt: a.systemPrompt,
    providerId: a.providerId ?? '',
    model: a.model,
    temperature: a.temperature || '0.7',
    temperatureEnabled: a.temperature !== '',
    maxTokens: a.maxTokens || '4096',
    maxTokensEnabled: a.maxTokens !== '',
    promptSuggestions: [...a.promptSuggestions],
  }
}

function AssistantForm({ assistant }: { assistant: Assistant }): React.JSX.Element {
  const { updateAssistant, deleteAssistant } = useAssistantStore()
  const providers = useProviderStore((s) => s.providers)

  const [form, setForm] = useState<AssistantFormState>(() => stateFromAssistant(assistant))
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    setForm(stateFromAssistant(assistant))
  }, [assistant])

  const commit = useCallback(
    (partial: Partial<Assistant>) => {
      updateAssistant(assistant.id, partial)
    },
    [assistant.id, updateAssistant],
  )

  const change = (field: keyof AssistantFormState, value: string | boolean | string[]): void => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleBlur = (field: keyof AssistantFormState): void => {
    const value = form[field]
    switch (field) {
      case 'name':
        if (typeof value === 'string' && value.trim()) commit({ name: value })
        break
      case 'description':
        commit({ description: value as string })
        break
      case 'emoji':
        commit({ emoji: (value as string) || '🤖' })
        break
      case 'systemPrompt':
        commit({ systemPrompt: value as string })
        break
      case 'model':
        commit({ model: value as string })
        break
      case 'providerId': {
        const id = value as string
        commit({ providerId: id || null })
        break
      }
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
    change('maxTokensEnabled', enabled)
    commit({ maxTokens: enabled ? form.maxTokens : '' })
  }

  const handleMaxTokensCommit = (value: number): void => {
    const str = value.toString()
    change('maxTokens', str)
    commit({ maxTokens: str })
  }

  const handleAddSuggestion = (): void => {
    if (form.promptSuggestions.length >= 4) return
    const next = [...form.promptSuggestions, '']
    change('promptSuggestions', next)
  }

  const handleUpdateSuggestion = (index: number, value: string): void => {
    const next = [...form.promptSuggestions]
    next[index] = value
    change('promptSuggestions', next)
  }

  const handleSuggestionBlur = (): void => {
    commit({ promptSuggestions: form.promptSuggestions.filter((s) => s.trim()) })
  }

  const handleRemoveSuggestion = (index: number): void => {
    const next = form.promptSuggestions.filter((_, i) => i !== index)
    change('promptSuggestions', next)
    commit({ promptSuggestions: next.filter((s) => s.trim()) })
  }

  const handleDelete = async (): Promise<void> => {
    await deleteAssistant(assistant.id)
    setConfirmDelete(false)
  }

  const enabledProviders = providers.filter((p) => p.enabled)
  const temperatureValue = parseFloat(form.temperature) || 0.7
  const maxTokensValue = parseInt(form.maxTokens) || 4096

  return (
    <ScrollArea className="flex-1">
      <div className="space-y-6 p-6">
        {/* Identity */}
        <div className="rounded-xl border bg-card/50 p-5">
          <h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            基本信息
          </h3>
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="w-20 space-y-1.5">
                <Label htmlFor="emoji" className="text-sm">
                  图标
                </Label>
                <Input
                  id="emoji"
                  value={form.emoji}
                  onChange={(e) => change('emoji', e.target.value)}
                  onBlur={() => handleBlur('emoji')}
                  className="text-center text-lg"
                  maxLength={2}
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="name" className="text-sm">
                  名称
                </Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => change('name', e.target.value)}
                  onBlur={() => handleBlur('name')}
                  placeholder="助手名称"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-sm">
                描述
              </Label>
              <Input
                id="description"
                value={form.description}
                onChange={(e) => change('description', e.target.value)}
                onBlur={() => handleBlur('description')}
                placeholder="简要描述助手的用途..."
              />
            </div>
          </div>
        </div>

        {/* System Prompt */}
        <div className="rounded-xl border bg-card/50 p-5">
          <h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            系统提示词
          </h3>
          <Textarea
            rows={6}
            value={form.systemPrompt}
            onChange={(e) => change('systemPrompt', e.target.value)}
            onBlur={() => handleBlur('systemPrompt')}
            placeholder="设定助手的角色和行为..."
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            定义助手的角色、能力和行为规则。留空则使用全局系统提示词。
          </p>
        </div>

        {/* Model Configuration */}
        <div className="rounded-xl border bg-card/50 px-5">
          <h3 className="py-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            模型配置
          </h3>

          {/* Provider */}
          <div className="border-t border-border/40 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="provider" className="text-sm">
                模型服务
              </Label>
              <select
                id="provider"
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
              <p className="text-xs text-muted-foreground">留空时使用全局默认服务商。</p>
            </div>
          </div>

          {/* Model */}
          <div className="border-t border-border/40 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="model" className="text-sm">
                模型名
              </Label>
              <Input
                id="model"
                value={form.model}
                onChange={(e) => change('model', e.target.value)}
                onBlur={() => handleBlur('model')}
                placeholder="留空使用服务商默认模型"
              />
            </div>
          </div>

          {/* Temperature */}
          <div className="border-t border-border/40">
            <div className="flex items-center justify-between py-4">
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
              <div className="pb-4">
                <Slider
                  min={0}
                  max={2}
                  step={0.1}
                  value={[temperatureValue]}
                  onValueChange={([v]) => change('temperature', v.toString())}
                  onValueCommit={([v]) => handleTemperatureCommit(v)}
                />
                <div className="mt-1.5 flex justify-between px-0.5">
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
          <div className="border-t border-border/40">
            <div className="flex items-center justify-between py-4">
              <span className="text-sm">最大 Token 数</span>
              <div className="flex items-center gap-3">
                {form.maxTokensEnabled && (
                  <span className="font-mono text-xs text-muted-foreground">{maxTokensValue}</span>
                )}
                <Switch checked={form.maxTokensEnabled} onCheckedChange={handleMaxTokensToggle} />
              </div>
            </div>
            {form.maxTokensEnabled && (
              <div className="pb-4">
                <Slider
                  min={256}
                  max={128000}
                  step={256}
                  value={[maxTokensValue]}
                  onValueChange={([v]) => change('maxTokens', v.toString())}
                  onValueCommit={([v]) => handleMaxTokensCommit(v)}
                />
                <div className="mt-1.5 flex justify-between px-0.5">
                  {['256', '32K', '64K', '96K', '128K'].map((mark) => (
                    <span key={mark} className="text-[11px] text-muted-foreground/50">
                      {mark}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Prompt Suggestions */}
        <div className="rounded-xl border bg-card/50 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              提示词建议
            </h3>
            {form.promptSuggestions.length < 4 && (
              <button
                onClick={handleAddSuggestion}
                className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground">
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
          {form.promptSuggestions.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              添加提示词建议，用户选择助手后会在欢迎页面展示。最多 4 条。
            </p>
          ) : (
            <div className="space-y-2">
              {form.promptSuggestions.map((suggestion, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={suggestion}
                    onChange={(e) => handleUpdateSuggestion(index, e.target.value)}
                    onBlur={handleSuggestionBlur}
                    placeholder={`建议 ${index + 1}`}
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemoveSuggestion(index)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Delete */}
        <div className="rounded-xl border border-destructive/20 bg-card/50 p-5">
          {confirmDelete ? (
            <div className="flex items-center justify-between">
              <span className="text-sm text-destructive">确定要删除此助手吗？</span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                  取消
                </Button>
                <Button variant="destructive" size="sm" onClick={handleDelete}>
                  确认删除
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setConfirmDelete(true)}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              删除助手
            </Button>
          )}
        </div>
      </div>
    </ScrollArea>
  )
}
