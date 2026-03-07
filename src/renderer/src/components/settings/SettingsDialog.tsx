import { useState } from 'react'
import type { ApiProvider } from '@shared/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@renderer/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { Button } from '@renderer/components/ui/button'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { ProviderSettings } from './ProviderSettings'
import { ModelSettings } from './ModelSettings'
import { ConnectionTest } from './ConnectionTest'
import type { SettingsFormState } from './types'

const DEFAULT_FORM: SettingsFormState = {
  provider: 'openai',
  apiKey: '',
  baseUrl: '',
  endpoint: '',
  apiVersion: '',
  deploymentName: '',
  model: 'gpt-4o',
  temperature: '0.7',
  maxTokens: '4096',
  systemPrompt: '',
}

function formStateFromSettings(settings: Record<string, string>): SettingsFormState {
  return {
    provider: (settings['api.provider'] as ApiProvider) || DEFAULT_FORM.provider,
    apiKey: settings['api.apiKey'] || DEFAULT_FORM.apiKey,
    baseUrl: settings['api.baseUrl'] || DEFAULT_FORM.baseUrl,
    endpoint: settings['api.endpoint'] || DEFAULT_FORM.endpoint,
    apiVersion: settings['api.apiVersion'] || DEFAULT_FORM.apiVersion,
    deploymentName: settings['api.deploymentName'] || DEFAULT_FORM.deploymentName,
    model: settings['api.model'] || DEFAULT_FORM.model,
    temperature: settings['api.temperature'] || DEFAULT_FORM.temperature,
    maxTokens: settings['api.maxTokens'] || DEFAULT_FORM.maxTokens,
    systemPrompt: settings['api.systemPrompt'] || DEFAULT_FORM.systemPrompt,
  }
}

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps): React.JSX.Element {
  const { settings, isSaving, saveSettings } = useSettingsStore()
  const [formState, setFormState] = useState<SettingsFormState>(DEFAULT_FORM)
  const [prevOpen, setPrevOpen] = useState(false)

  // Reinitialize form when dialog transitions from closed to open
  if (open && !prevOpen) {
    setPrevOpen(true)
    setFormState(formStateFromSettings(settings))
  }
  if (!open && prevOpen) {
    setPrevOpen(false)
  }

  const handleChange = (field: keyof SettingsFormState, value: string): void => {
    setFormState((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async (): Promise<void> => {
    const values: Record<string, string> = {
      'api.provider': formState.provider,
      'api.apiKey': formState.apiKey,
      'api.baseUrl': formState.baseUrl,
      'api.endpoint': formState.endpoint,
      'api.apiVersion': formState.apiVersion,
      'api.deploymentName': formState.deploymentName,
      'api.model': formState.model,
      'api.temperature': formState.temperature,
      'api.maxTokens': formState.maxTokens,
      'api.systemPrompt': formState.systemPrompt,
    }

    const ok = await saveSettings(values)
    if (ok) {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Configure your AI provider and model parameters.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="provider" className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="provider">Provider</TabsTrigger>
            <TabsTrigger value="model">Model</TabsTrigger>
          </TabsList>
          <TabsContent value="provider" className="mt-4">
            <ProviderSettings formState={formState} onChange={handleChange} />
          </TabsContent>
          <TabsContent value="model" className="mt-4">
            <ModelSettings formState={formState} onChange={handleChange} />
          </TabsContent>
        </Tabs>

        <div className="mt-4 border-t pt-4">
          <ConnectionTest formState={formState} />
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
