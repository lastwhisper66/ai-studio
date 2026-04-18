import { useEffect, useRef } from 'react'
import i18n from '@renderer/i18n'
import { AppLayout } from '@renderer/components/layout/AppLayout'
import { useConversationStore } from '@renderer/stores/conversationStore'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { useProviderStore } from '@renderer/stores/providerStore'
import { useAssistantStore } from '@renderer/stores/assistantStore'
import { usePhraseStore } from '@renderer/stores/phraseStore'
import { useModelDefinitionStore } from '@renderer/stores/modelDefinitionStore'
import { useModelGroupStore } from '@renderer/stores/modelGroupStore'
import { useKeybindingStore } from '@renderer/stores/keybindingStore'
import { useKeyboardShortcuts } from '@renderer/hooks/useKeyboardShortcuts'
import { useFontSettings } from '@renderer/hooks/useFontSettings'
import { ZOOM_STEP, clampZoom } from '@shared/zoom'

function App(): React.JSX.Element {
  const loadConversations = useConversationStore((s) => s.loadConversations)
  const loadSettings = useSettingsStore((s) => s.loadSettings)
  const loadProviders = useProviderStore((s) => s.loadProviders)
  const loadAssistants = useAssistantStore((s) => s.loadAssistants)
  const loadPhrases = usePhraseStore((s) => s.loadPhrases)
  const loadModelDefinitions = useModelDefinitionStore((s) => s.load)
  const loadModelGroups = useModelGroupStore((s) => s.load)
  const initKeybindings = useKeybindingStore((s) => s.init)
  const settingsLoaded = useSettingsStore((s) => s.isLoaded)

  useEffect(() => {
    loadConversations()
    loadSettings()
    loadProviders()
    loadAssistants()
    loadPhrases()
    loadModelDefinitions()
    loadModelGroups()
  }, [
    loadConversations,
    loadSettings,
    loadProviders,
    loadAssistants,
    loadPhrases,
    loadModelDefinitions,
    loadModelGroups,
  ])

  // Refresh settings when the main window regains focus so that changes made
  // in other windows (e.g. the quick-assistant popup) are picked up.
  useEffect(() => {
    const handleFocus = (): void => {
      loadSettings()
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [loadSettings])

  // Initialize keybinding store after settings are loaded
  useEffect(() => {
    if (settingsLoaded) initKeybindings()
  }, [settingsLoaded, initKeybindings])

  // Reconcile i18n with the persisted `general.language` setting exactly once
  // after settings load. On a fresh install the setting is empty, so we adopt
  // whatever the renderer's LanguageDetector resolved to and persist it — the
  // main process (tray / dialogs / file picker) reads this key at startup and
  // would otherwise stay on its default, diverging from the UI.
  const languageReconciled = useRef(false)
  useEffect(() => {
    if (!settingsLoaded || languageReconciled.current) return
    languageReconciled.current = true
    const { settings, saveSettings } = useSettingsStore.getState()
    const stored = settings['general.language']
    const detected = i18n.resolvedLanguage ?? i18n.language ?? 'en'
    if (!stored) {
      saveSettings({ 'general.language': detected })
    } else if (stored !== i18n.resolvedLanguage) {
      i18n.changeLanguage(stored)
    }
  }, [settingsLoaded])

  // Ctrl+Wheel zoom — use ref to avoid async read-modify-write race
  const zoomRef = useRef(1.0)

  useEffect(() => {
    window.api.getZoom().then((f) => {
      zoomRef.current = f
    })
    const unsub = window.api.onZoomChanged((f) => {
      zoomRef.current = f
    })
    return unsub
  }, [])

  useEffect(() => {
    const handler = (e: WheelEvent): void => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP
      const next = clampZoom(zoomRef.current + delta)
      window.api.setZoom(next)
    }
    window.addEventListener('wheel', handler, { passive: false })
    return () => window.removeEventListener('wheel', handler)
  }, [])

  useFontSettings()
  useKeyboardShortcuts()

  return <AppLayout />
}

export default App
