import { useState, useEffect } from 'react'
import { Label } from '@renderer/components/ui/label'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import { Separator } from '@renderer/components/ui/separator'
import { Eye, EyeOff, Trash2, Star, Loader2, CheckCircle2, XCircle } from 'lucide-react'
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
        Select a provider or add a new one
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
  })
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const template = getTemplateByType(provider.type)
  const isAzure = provider.type === 'azure'

  // Sync draft when provider changes externally
  useEffect(() => {
    setDraft({
      name: provider.name,
      apiKey: provider.apiKey,
      baseUrl: provider.baseUrl,
      model: provider.model,
      endpoint: provider.endpoint,
      apiVersion: provider.apiVersion,
      deploymentName: provider.deploymentName,
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
        setTestResult({ success: true, message: res.data || 'Connection successful!' })
      } else {
        setTestResult({ success: false, message: res.error || 'Connection failed' })
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

  const change = (field: keyof typeof draft, value: string): void => {
    setDraft((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-lg space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <span
            className="h-4 w-4 shrink-0 rounded-full"
            style={{ backgroundColor: template?.color ?? '#6b7280' }}
          />
          <h2 className="text-lg font-semibold">{provider.name}</h2>
          <span className="text-muted-foreground text-xs uppercase">{provider.type}</span>
          {isActive && (
            <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium">
              Active
            </span>
          )}
        </div>

        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={draft.name} onChange={(e) => change('name', e.target.value)} />
        </div>

        {/* API Key */}
        <div className="space-y-2">
          <Label htmlFor="apiKey">API Key</Label>
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
        </div>

        {/* Azure endpoint */}
        {isAzure && (
          <div className="space-y-2">
            <Label htmlFor="endpoint">Endpoint</Label>
            <Input
              id="endpoint"
              value={draft.endpoint}
              onChange={(e) => change('endpoint', e.target.value)}
              placeholder="https://your-resource.openai.azure.com"
            />
          </div>
        )}

        {/* Base URL (non-Azure) */}
        {!isAzure && (
          <div className="space-y-2">
            <Label htmlFor="baseUrl">Base URL</Label>
            <Input
              id="baseUrl"
              value={draft.baseUrl}
              onChange={(e) => change('baseUrl', e.target.value)}
              placeholder={template?.defaultBaseUrl || 'https://api.openai.com/v1'}
            />
          </div>
        )}

        {/* Azure specific fields */}
        {isAzure && (
          <>
            <div className="space-y-2">
              <Label htmlFor="apiVersion">API Version</Label>
              <Input
                id="apiVersion"
                value={draft.apiVersion}
                onChange={(e) => change('apiVersion', e.target.value)}
                placeholder="2024-10-01-preview"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deploymentName">Deployment Name</Label>
              <Input
                id="deploymentName"
                value={draft.deploymentName}
                onChange={(e) => change('deploymentName', e.target.value)}
                placeholder="my-gpt4o-deployment"
              />
            </div>
          </>
        )}

        {/* Model */}
        <div className="space-y-2">
          <Label htmlFor="model">Model</Label>
          <Input
            id="model"
            value={draft.model}
            onChange={(e) => change('model', e.target.value)}
            placeholder={template?.defaultModels[0] ?? 'gpt-4o'}
          />
        </div>

        <Separator />

        {/* Test connection */}
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={isTesting || !draft.apiKey || !draft.model}>
            {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Test Connection
          </Button>
          {testResult && (
            <div
              className={`flex items-center gap-1.5 text-sm ${testResult.success ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <span className="max-w-[300px] truncate">{testResult.message}</span>
            </div>
          )}
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
          {!isActive && (
            <Button variant="outline" onClick={() => onSetActive(provider.id)}>
              <Star className="mr-1.5 h-4 w-4" />
              Set as Active
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="mr-1.5 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  )
}
