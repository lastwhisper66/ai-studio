import { createContext } from 'react'
import type { ColorThemeId } from './themes'

type Theme = 'light' | 'dark' | 'system'
type ResolvedTheme = Exclude<Theme, 'system'>

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
  colorThemeId: ColorThemeId
  setColorTheme: (id: ColorThemeId) => void
}

export type { Theme, ResolvedTheme, ThemeContextValue }
export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)
