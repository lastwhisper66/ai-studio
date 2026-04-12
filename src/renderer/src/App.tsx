import { useEffect, useRef } from 'react'
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
  const settings = useSettingsStore((s) => s.settings)

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

  // Initialize keybinding store after settings are loaded
  useEffect(() => {
    if (settingsLoaded) initKeybindings()
  }, [settingsLoaded, initKeybindings])

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

  // Apply font settings to CSS variables
  const fontFamily = settings['display.fontFamily']
  const codeFontFamily = settings['display.codeFontFamily']

  useEffect(() => {
    const root = document.documentElement
    // Escape quotes to prevent CSS injection from malicious font names
    const esc = (s: string): string => s.replace(/"/g, '\\"')

    if (fontFamily) {
      root.style.setProperty(
        '--font-family-sans',
        `"${esc(fontFamily)}", -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
      )
    } else {
      root.style.removeProperty('--font-family-sans')
    }

    if (codeFontFamily) {
      root.style.setProperty(
        '--font-family-mono',
        `"${esc(codeFontFamily)}", ui-monospace, SFMono-Regular, monospace`,
      )
    } else {
      root.style.removeProperty('--font-family-mono')
    }
  }, [fontFamily, codeFontFamily])

  useKeyboardShortcuts()

  return <AppLayout />
}

export default App
