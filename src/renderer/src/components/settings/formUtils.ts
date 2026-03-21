import type { SettingsFormState } from './types'

export const DEFAULT_FORM: SettingsFormState = {
  temperature: '0.7',
  temperatureEnabled: 'false',
  topP: '1',
  topPEnabled: 'false',
  contextCount: '5',
  maxCompletionTokens: '4096',
  maxCompletionTokensEnabled: 'false',
  streaming: 'true',
  systemPrompt: '',
}

export const SETTINGS_KEY_MAP: Record<keyof SettingsFormState, string> = {
  temperature: 'api.temperature',
  temperatureEnabled: 'api.temperatureEnabled',
  topP: 'api.topP',
  topPEnabled: 'api.topPEnabled',
  contextCount: 'api.contextCount',
  maxCompletionTokens: 'api.maxCompletionTokens',
  maxCompletionTokensEnabled: 'api.maxCompletionTokensEnabled',
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
    maxCompletionTokens: settings['api.maxCompletionTokens'] || DEFAULT_FORM.maxCompletionTokens,
    maxCompletionTokensEnabled:
      settings['api.maxCompletionTokensEnabled'] || DEFAULT_FORM.maxCompletionTokensEnabled,
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
