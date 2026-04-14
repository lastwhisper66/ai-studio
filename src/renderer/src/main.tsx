import './assets/main.css'
import './i18n'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from './components/theme/ThemeProvider'
import { TooltipProvider } from './components/ui/tooltip'
import App from './App'
import { QuickAssistantApp } from './components/quick-assistant/QuickAssistantApp'
import { ScreenshotApp } from './components/screenshot/ScreenshotApp'

const params = new URLSearchParams(window.location.search)
const mode = params.get('mode')

// Quick assistant and screenshot run in transparent BrowserWindows — make body/html
// transparent so only the actual content shows.
if (mode === 'quick-assistant' || mode === 'screenshot') {
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
      ) : (
        <TooltipProvider>
          <App />
        </TooltipProvider>
      )}
    </ThemeProvider>
  </StrictMode>,
)
