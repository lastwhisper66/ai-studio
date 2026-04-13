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
