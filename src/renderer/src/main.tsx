import './assets/main.css'
import './i18n'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from './components/theme/ThemeProvider'
import { TooltipProvider } from './components/ui/tooltip'
import App from './App'
import { QuickAssistantApp } from './components/quick-assistant/QuickAssistantApp'

const params = new URLSearchParams(window.location.search)
const mode = params.get('mode')

// Quick assistant runs in a transparent BrowserWindow — make body/html
// transparent so only the rounded-corner container shows a background.
if (mode === 'quick-assistant') {
  document.documentElement.style.background = 'transparent'
  document.body.style.background = 'transparent'
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      {mode === 'quick-assistant' ? (
        <QuickAssistantApp />
      ) : (
        <TooltipProvider>
          <App />
        </TooltipProvider>
      )}
    </ThemeProvider>
  </StrictMode>,
)
