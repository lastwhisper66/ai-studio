import type { SettingsFormState } from './types'

export const DEFAULT_FORM: SettingsFormState = {
  temperature: '0.7',
  temperatureEnabled: 'false',
  topP: '1',
  topPEnabled: 'false',
  contextCount: '5',
  maxTokens: '4096',
  maxTokensEnabled: 'false',
  streaming: 'true',
  systemPrompt: '',
}

export const SETTINGS_KEY_MAP: Record<keyof SettingsFormState, string> = {
  temperature: 'api.temperature',
  temperatureEnabled: 'api.temperatureEnabled',
  topP: 'api.topP',
  topPEnabled: 'api.topPEnabled',
  contextCount: 'api.contextCount',
  maxTokens: 'api.maxTokens',
  maxTokensEnabled: 'api.maxTokensEnabled',
  streaming: 'api.streaming',
  systemPrompt: 'api.systemPrompt',
}

export function formStateFromSettings(settings: Record<string, string>): SettingsFormState {
  return {
    temperature: settings['api.temperature'] || DEFAULT_FORM.temperature,
    temperatureEnabled: settings['api.temperatureEnabled'] || DEFAULT_FORM.temperatureEnabled,
    topP: settings['api.topP'] || DEFAULT_FORM.topP,
    topPEnabled: settings['api.topPEnabled'] || DEFAULT_FORM.topPEnabled,
    contextCount: settings['api.contextCount'] || DEFAULT_FORM.contextCount,
    maxTokens: settings['api.maxTokens'] || DEFAULT_FORM.maxTokens,
    maxTokensEnabled: settings['api.maxTokensEnabled'] || DEFAULT_FORM.maxTokensEnabled,
    streaming: settings['api.streaming'] || DEFAULT_FORM.streaming,
    systemPrompt: settings['api.systemPrompt'] || DEFAULT_FORM.systemPrompt,
  }
}

export function modelKeys(form: SettingsFormState): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [field, key] of Object.entries(SETTINGS_KEY_MAP)) {
    result[key] = form[field as keyof SettingsFormState]
  }
  return result
}
