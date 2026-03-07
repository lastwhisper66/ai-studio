import { Label } from '@renderer/components/ui/label'
import { Input } from '@renderer/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import type { SettingsFormState } from './types'

interface ProviderSettingsProps {
  formState: SettingsFormState
  onChange: (field: keyof SettingsFormState, value: string) => void
}

export function ProviderSettings({
  formState,
  onChange,
}: ProviderSettingsProps): React.JSX.Element {
  const [showApiKey, setShowApiKey] = useState(false)

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="provider">Provider</Label>
        <Select value={formState.provider} onValueChange={(v) => onChange('provider', v)}>
          <SelectTrigger id="provider">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="openai">OpenAI</SelectItem>
            <SelectItem value="azure">Azure OpenAI</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {formState.provider === 'azure' && (
        <div className="space-y-2">
          <Label htmlFor="endpoint">Endpoint</Label>
          <Input
            id="endpoint"
            value={formState.endpoint}
            onChange={(e) => onChange('endpoint', e.target.value)}
            placeholder="https://your-resource.openai.azure.com"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="apiKey">API Key</Label>
        <div className="relative">
          <Input
            id="apiKey"
            type={showApiKey ? 'text' : 'password'}
            value={formState.apiKey}
            onChange={(e) => onChange('apiKey', e.target.value)}
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

      {formState.provider === 'openai' && (
        <div className="space-y-2">
          <Label htmlFor="baseUrl">Base URL (optional)</Label>
          <Input
            id="baseUrl"
            value={formState.baseUrl}
            onChange={(e) => onChange('baseUrl', e.target.value)}
            placeholder="https://api.openai.com/v1"
          />
        </div>
      )}

      {formState.provider === 'azure' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="apiVersion">API Version</Label>
            <Input
              id="apiVersion"
              value={formState.apiVersion}
              onChange={(e) => onChange('apiVersion', e.target.value)}
              placeholder="2024-06-01"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deploymentName">Deployment Name</Label>
            <Input
              id="deploymentName"
              value={formState.deploymentName}
              onChange={(e) => onChange('deploymentName', e.target.value)}
              placeholder="my-gpt4o-deployment"
            />
          </div>
        </>
      )}

      <div className="space-y-2">
        <Label htmlFor="model">Model</Label>
        <Input
          id="model"
          value={formState.model}
          onChange={(e) => onChange('model', e.target.value)}
          placeholder="gpt-4o"
        />
      </div>
    </div>
  )
}
