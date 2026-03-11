import { createContext } from 'react'

type Theme = 'light' | 'dark' | 'system'
type ResolvedTheme = Exclude<Theme, 'system'>

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

export type { Theme, ResolvedTheme, ThemeContextValue }
export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)
