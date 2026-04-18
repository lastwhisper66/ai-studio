import { useEffect } from 'react'
import { useSettingsStore } from '@renderer/stores/settingsStore'

/**
 * Applies user font settings as CSS custom properties on the document root.
 * Must be called in every top-level window component (App, QuickAssistantApp, etc.)
 * so each BrowserWindow respects the configured fonts.
 */
export function useFontSettings(): void {
  const fontFamily = useSettingsStore((s) => s.settings['display.fontFamily'])
  const codeFontFamily = useSettingsStore((s) => s.settings['display.codeFontFamily'])

  useEffect(() => {
    const root = document.documentElement
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
}
