import type { SettingsFormState } from './types'

export const DEFAULT_FORM: SettingsFormState = {
  temperature: '0.7',
  maxTokens: '4096',
  systemPrompt: '',
}

export function formStateFromSettings(settings: Record<string, string>): SettingsFormState {
  return {
    temperature: settings['api.temperature'] || DEFAULT_FORM.temperature,
    maxTokens: settings['api.maxTokens'] || DEFAULT_FORM.maxTokens,
    systemPrompt: settings['api.systemPrompt'] || DEFAULT_FORM.systemPrompt,
  }
}

export function modelKeys(form: SettingsFormState): Record<string, string> {
  return {
    'api.temperature': form.temperature,
    'api.maxTokens': form.maxTokens,
    'api.systemPrompt': form.systemPrompt,
  }
}
