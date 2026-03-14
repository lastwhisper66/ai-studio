import { useState, useEffect } from 'react'
import { Label } from '@renderer/components/ui/label'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import { Switch } from '@renderer/components/ui/switch'
import { Eye, EyeOff, Trash2, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { useProviderStore } from '@renderer/stores/providerStore'
import type { Provider } from '@shared/types'
import { getTemplateByType } from './provider-templates'

export function ProviderDetail(): React.JSX.Element {
  const {
    providers,
    selectedProviderId,
    activeProviderId,
    updateProvider,
    deleteProvider,
    setActiveProvider,
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
      onUpdate={updateProvider}
      onDelete={deleteProvider}
      onSetActive={setActiveProvider}
    />
  )
}

interface ProviderFormProps {
  provider: Provider
  isActive: boolean
  onUpdate: (id: string, data: Partial<Provider>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onSetActive: (id: string) => Promise<void>
}

function SettingGroup({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="space-y-4">
      <h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
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
  onUpdate,
  onDelete,
  onSetActive,
}: ProviderFormProps): React.JSX.Element {
  const [showApiKey, setShowApiKey] = useState(false)
  const [draft, setDraft] = useState({
    name: provider.name,
    apiKey: provider.apiKey,
    baseUrl: provider.baseUrl,
    model: provider.model,
    endpoint: provider.endpoint,
    apiVersion: provider.apiVersion,
    deploymentName: provider.deploymentName,
    enabled: provider.enabled,
  })
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
      model: provider.model,
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
      const testProvider: Provider = { ...provider, ...draft }
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

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-xl space-y-6 p-6">
        {/* Header with provider info and controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className="h-5 w-5 shrink-0 rounded-full border border-black/10 dark:border-white/10"
              style={{ backgroundColor: template?.color ?? '#6b7280' }}
            />
            <div>
              <h2 className="text-lg font-semibold leading-tight">{provider.name}</h2>
              <span className="text-muted-foreground text-xs">{provider.type.toUpperCase()}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isActive && (
              <span className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs font-medium">
                当前使用
              </span>
            )}
            <Switch
              checked={draft.enabled}
              onCheckedChange={(v) => change('enabled', v)}
            />
          </div>
        </div>

        <div className="border-t" />

        {/* Basic info section */}
        <SettingGroup title="基本信息">
          <SettingRow label="名称" htmlFor="name">
            <Input id="name" value={draft.name} onChange={(e) => change('name', e.target.value)} />
          </SettingRow>
        </SettingGroup>

        {/* API configuration */}
        <SettingGroup title="API 配置">
          <SettingRow label="API Key" htmlFor="apiKey">
            <div className="flex gap-2">
              <div className="relative flex-1">
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 shrink-0"
                onClick={handleTest}
                disabled={isTesting || !draft.apiKey || !draft.model}>
                {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : '检查'}
              </Button>
            </div>
            {testResult && (
              <div
                className={`mt-1.5 flex items-center gap-1.5 text-xs ${testResult.success ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                {testResult.success ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
                <span className="max-w-[360px] truncate">{testResult.message}</span>
              </div>
            )}
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

        {/* Model configuration */}
        <SettingGroup title="模型配置">
          <SettingRow label="模型" htmlFor="model">
            <Input
              id="model"
              value={draft.model}
              onChange={(e) => change('model', e.target.value)}
              placeholder={template?.defaultModels[0] ?? 'gpt-4o'}
            />
            {template && template.defaultModels.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {template.defaultModels.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => change('model', m)}
                    className="bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded px-2 py-0.5 text-xs transition-colors">
                    {m}
                  </button>
                ))}
              </div>
            )}
          </SettingRow>
        </SettingGroup>

        <div className="border-t" />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={isSaving} size="sm">
            {isSaving ? '保存中...' : '保存'}
          </Button>
          {!isActive && (
            <Button variant="outline" size="sm" onClick={() => onSetActive(provider.id)}>
              设为默认
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleDelete}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            删除
          </Button>
        </div>
      </div>
    </div>
  )
}
