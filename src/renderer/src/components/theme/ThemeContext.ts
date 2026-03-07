import { createContext } from 'react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
}

export type { Theme, ThemeContextValue }
export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)
