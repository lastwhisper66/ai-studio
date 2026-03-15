import { useState, useEffect, useCallback } from 'react'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { ModelSettings } from './ModelSettings'
import { DEFAULT_FORM, SETTINGS_KEY_MAP, formStateFromSettings, modelKeys } from './formUtils'
import type { SettingsFormState } from './types'

export function ModelSection(): React.JSX.Element {
  const { settings, saveSettings } = useSettingsStore()
  const [formState, setFormState] = useState<SettingsFormState>(() =>
    formStateFromSettings(settings),
  )

  useEffect(() => {
    setFormState(formStateFromSettings(settings))
  }, [settings])

  // Local-only update (for slider dragging, textarea typing)
  const handleChange = useCallback((field: keyof SettingsFormState, value: string): void => {
    setFormState((prev) => ({ ...prev, [field]: value }))
  }, [])

  // Update + persist (for toggle switches, slider commit, textarea blur)
  const handleCommit = useCallback(
    (field: keyof SettingsFormState, value: string): void => {
      setFormState((prev) => ({ ...prev, [field]: value }))
      const key = SETTINGS_KEY_MAP[field]
      saveSettings({ [key]: value })
    },
    [saveSettings],
  )

  const handleReset = useCallback((): void => {
    setFormState(DEFAULT_FORM)
    saveSettings(modelKeys(DEFAULT_FORM))
  }, [saveSettings])

  return (
    <ModelSettings
      formState={formState}
      onChange={handleChange}
      onCommit={handleCommit}
      onReset={handleReset}
    />
  )
}
