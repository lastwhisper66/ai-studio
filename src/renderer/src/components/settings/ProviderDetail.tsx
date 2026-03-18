import { useState, useEffect } from 'react'
import { Label } from '@renderer/components/ui/label'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import { Switch } from '@renderer/components/ui/switch'
import { Eye, EyeOff, Trash2, Loader2, CheckCircle2, XCircle, Plus, X } from 'lucide-react'
import { useProviderStore } from '@renderer/stores/providerStore'
import type { Provider } from '@shared/types'
import { getTemplateByType } from './provider-templates'

export function ProviderDetail(): React.JSX.Element {
  const {
    providers,
    models,
    selectedProviderId,
    activeProviderId,
    updateProvider,
    deleteProvider,
    setActiveProvider,
    addModel,
    removeModel,
  } = useProviderStore()

  const provider = providers.find((p) => p.id === selectedProviderId)

  if (!provider) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
        请选择一个服务商或添加新服务商
      </div>
    )
  }

  return (
    <ProviderForm
      key={provider.id}
      provider={provider}
      isActive={activeProviderId === provider.id}
      providerModels={models.filter((m) => m.providerId === provider.id)}
      onUpdate={updateProvider}
      onDelete={deleteProvider}
      onSetActive={setActiveProvider}
      onAddModel={addModel}
      onRemoveModel={removeModel}
    />
  )
}

interface ProviderFormProps {
  provider: Provider
  isActive: boolean
  providerModels: { id: string; name: string; enabled: boolean }[]
  onUpdate: (id: string, data: Partial<Provider>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onSetActive: (id: string) => Promise<void>
  onAddModel: (providerId: string, name: string) => Promise<unknown>
  onRemoveModel: (id: string) => Promise<void>
}

function SettingGroup({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="rounded-xl border bg-card/50 p-5">
      <h3 className="text-muted-foreground mb-4 text-xs font-medium uppercase tracking-wider">
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function SettingRow({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-sm">
        {label}
      </Label>
      {children}
    </div>
  )
}

function ProviderForm({
  provider,
  isActive,
  providerModels,
  onUpdate,
  onDelete,
  onSetActive,
  onAddModel,
  onRemoveModel,
}: ProviderFormProps): React.JSX.Element {
  const [showApiKey, setShowApiKey] = useState(false)
  const [draft, setDraft] = useState({
    name: provider.name,
    apiKey: provider.apiKey,
    baseUrl: provider.baseUrl,
    endpoint: provider.endpoint,
    apiVersion: provider.apiVersion,
    deploymentName: provider.deploymentName,
    enabled: provider.enabled,
  })
  const [newModelName, setNewModelName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const template = getTemplateByType(provider.type)
  const isAzure = provider.type === 'azure'

  useEffect(() => {
    setDraft({
      name: provider.name,
      apiKey: provider.apiKey,
      baseUrl: provider.baseUrl,
      endpoint: provider.endpoint,
      apiVersion: provider.apiVersion,
      deploymentName: provider.deploymentName,
      enabled: provider.enabled,
    })
  }, [provider])

  const handleSave = async (): Promise<void> => {
    setIsSaving(true)
    try {
      await onUpdate(provider.id, draft)
    } finally {
      setIsSaving(false)
    }
  }

  const handleTest = async (): Promise<void> => {
    setIsTesting(true)
    setTestResult(null)
    try {
      const testProvider: Provider = {
        ...provider,
        ...draft,
        model: providerModels[0]?.name || provider.model,
      }
      const res = await window.api.testProviderConnection(testProvider)
      if (res.success) {
        setTestResult({ success: true, message: res.data || '连接成功！' })
      } else {
        setTestResult({ success: false, message: res.error || '连接失败' })
      }
    } catch (e) {
      setTestResult({ success: false, message: (e as Error).message })
    } finally {
      setIsTesting(false)
    }
  }

  const handleDelete = async (): Promise<void> => {
    await onDelete(provider.id)
  }

  const change = (field: keyof typeof draft, value: string | boolean): void => {
    setDraft((prev) => ({ ...prev, [field]: value }))
  }

  const handleAddModel = async (): Promise<void> => {
    const name = newModelName.trim()
    if (!name) return
    // Prevent duplicate names
    if (providerModels.some((m) => m.name === name)) return
    await onAddModel(provider.id, name)
    setNewModelName('')
  }

  const handleAddModelKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddModel()
    }
  }

  const handleQuickAddModel = async (name: string): Promise<void> => {
    if (providerModels.some((m) => m.name === name)) return
    await onAddModel(provider.id, name)
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="space-y-6 p-6">
        {/* Header with provider info and controls */}
        <div className="flex items-center justify-between rounded-xl border bg-card/50 p-5">
          <div className="flex items-center gap-3">
            <span
              className="h-8 w-8 shrink-0 rounded-lg border border-black/10 dark:border-white/10"
              style={{ backgroundColor: template?.color ?? '#6b7280' }}
            />
            <div>
              <h2 className="text-base font-semibold leading-tight">{provider.name}</h2>
              <span className="text-muted-foreground text-xs">{provider.type.toUpperCase()}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isActive && (
              <span className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs font-medium">
                当前使用
              </span>
            )}
            <Switch checked={draft.enabled} onCheckedChange={(v) => change('enabled', v)} />
          </div>
        </div>

        {/* Basic info section */}
        <SettingGroup title="基本信息">
          <SettingRow label="名称" htmlFor="name">
            <Input id="name" value={draft.name} onChange={(e) => change('name', e.target.value)} />
          </SettingRow>
        </SettingGroup>

        {/* API configuration */}
        <SettingGroup title="API 配置">
          <SettingRow label="API Key" htmlFor="apiKey">
            <div className="relative">
              <Input
                id="apiKey"
                type={showApiKey ? 'text' : 'password'}
                value={draft.apiKey}
                onChange={(e) => change('apiKey', e.target.value)}
                placeholder="sk-..."
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-0 right-0 h-full w-10"
                onClick={() => setShowApiKey(!showApiKey)}>
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </SettingRow>

          {isAzure ? (
            <>
              <SettingRow label="端点 (Endpoint)" htmlFor="endpoint">
                <Input
                  id="endpoint"
                  value={draft.endpoint}
                  onChange={(e) => change('endpoint', e.target.value)}
                  placeholder="https://your-resource.openai.azure.com"
                />
              </SettingRow>
              <SettingRow label="API 版本" htmlFor="apiVersion">
                <Input
                  id="apiVersion"
                  value={draft.apiVersion}
                  onChange={(e) => change('apiVersion', e.target.value)}
                  placeholder="2024-10-01-preview"
                />
              </SettingRow>
              <SettingRow label="部署名称" htmlFor="deploymentName">
                <Input
                  id="deploymentName"
                  value={draft.deploymentName}
                  onChange={(e) => change('deploymentName', e.target.value)}
                  placeholder="my-gpt4o-deployment"
                />
              </SettingRow>
            </>
          ) : (
            <SettingRow label="API 地址" htmlFor="baseUrl">
              <Input
                id="baseUrl"
                value={draft.baseUrl}
                onChange={(e) => change('baseUrl', e.target.value)}
                placeholder={template?.defaultBaseUrl || 'https://api.openai.com/v1'}
              />
            </SettingRow>
          )}
        </SettingGroup>

        {/* Model configuration — multi-model list */}
        <SettingGroup title="模型配置">
          <SettingRow label="模型列表">
            {/* Existing models as chips */}
            {providerModels.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {providerModels.map((m) => (
                  <span
                    key={m.id}
                    className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-sm">
                    {m.name}
                    <button
                      type="button"
                      onClick={() => onRemoveModel(m.id)}
                      className="hover:text-destructive ml-0.5 rounded-sm opacity-60 hover:opacity-100">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {/* Add model input */}
            <div className="flex gap-2">
              <Input
                value={newModelName}
                onChange={(e) => setNewModelName(e.target.value)}
                onKeyDown={handleAddModelKeyDown}
                placeholder="输入模型名称，如 gpt-4o"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddModel}
                disabled={!newModelName.trim()}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                添加
              </Button>
            </div>
            {/* Quick add from template */}
            {template && template.defaultModels.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {template.defaultModels
                  .filter((m) => !providerModels.some((pm) => pm.name === m))
                  .map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleQuickAddModel(m)}
                      className="bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded px-2 py-0.5 text-xs transition-colors">
                      + {m}
                    </button>
                  ))}
              </div>
            )}
          </SettingRow>
        </SettingGroup>

        {/* Actions */}
        <div className="flex items-center gap-2 rounded-xl border bg-card/50 p-5">
          <Button onClick={handleSave} disabled={isSaving} size="sm">
            {isSaving ? '保存中...' : '保存'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={isTesting || !draft.apiKey || providerModels.length === 0}>
            {isTesting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            {isTesting ? '检测中...' : '连接测试'}
          </Button>
          {!isActive && (
            <Button variant="outline" size="sm" onClick={() => onSetActive(provider.id)}>
              设为默认
            </Button>
          )}
          {testResult && (
            <div
              className={`flex items-center gap-1.5 text-xs ${testResult.success ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
              {testResult.success ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <XCircle className="h-3.5 w-3.5" />
              )}
              <span className="max-w-[360px] truncate">{testResult.message}</span>
            </div>
          )}
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleDelete}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            删除
          </Button>
        </div>
      </div>
    </div>
  )
}
