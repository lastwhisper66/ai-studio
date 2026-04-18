import './assets/main.css'
import './i18n'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from './components/theme/ThemeProvider'
import { TooltipProvider } from './components/ui/tooltip'
import App from './App'
import { QuickAssistantApp } from './components/quick-assistant/QuickAssistantApp'
import { ScreenshotApp } from './components/screenshot/ScreenshotApp'
import { SelectionToolbarApp } from './components/selection-toolbar/SelectionToolbarApp'
import { SelectionBubbleApp } from './components/selection-bubble/SelectionBubbleApp'

const params = new URLSearchParams(window.location.search)
const mode = params.get('mode')

// Transparent BrowserWindows — make body/html transparent so only the actual
// content shows.
if (
  mode === 'quick-assistant' ||
  mode === 'screenshot' ||
  mode === 'selection-toolbar' ||
  mode === 'selection-bubble'
) {
  document.documentElement.style.background = 'transparent'
  document.body.style.background = 'transparent'
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      {mode === 'quick-assistant' ? (
        <QuickAssistantApp />
      ) : mode === 'screenshot' ? (
        <ScreenshotApp />
      ) : mode === 'selection-toolbar' ? (
        <SelectionToolbarApp />
      ) : mode === 'selection-bubble' ? (
        <SelectionBubbleApp />
      ) : (
        <TooltipProvider>
          <App />
        </TooltipProvider>
      )}
    </ThemeProvider>
  </StrictMode>,
)
