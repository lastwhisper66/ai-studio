import type { ApiProvider } from '@shared/types'
import type { SettingsFormState } from './types'

export const DEFAULT_FORM: SettingsFormState = {
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

export function formStateFromSettings(settings: Record<string, string>): SettingsFormState {
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

export function providerKeys(form: SettingsFormState): Record<string, string> {
  return {
    'api.provider': form.provider,
    'api.apiKey': form.apiKey,
    'api.baseUrl': form.baseUrl,
    'api.endpoint': form.endpoint,
    'api.apiVersion': form.apiVersion,
    'api.deploymentName': form.deploymentName,
    'api.model': form.model,
  }
}

export function modelKeys(form: SettingsFormState): Record<string, string> {
  return {
    'api.temperature': form.temperature,
    'api.maxTokens': form.maxTokens,
    'api.systemPrompt': form.systemPrompt,
  }
}
