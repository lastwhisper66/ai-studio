import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ThemeContext, type ResolvedTheme, type Theme } from './ThemeContext'
import { colorThemes, DEFAULT_COLOR_THEME_ID } from './themes'
import type { ColorThemeId, ThemeColors } from './themes'

/** All CSS variable keys that color themes may set — used for cleanup on switch. */
const COLOR_VAR_KEYS = Object.keys(colorThemes[0].light) as (keyof ThemeColors)[]

function getStoredTheme(): Theme {
  const stored = localStorage.getItem('theme')
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'dark'
}

function getStoredColorTheme(): ColorThemeId {
  const stored = localStorage.getItem('colorTheme')
  return colorThemes.some((t) => t.id === stored) ? (stored as ColorThemeId) : DEFAULT_COLOR_THEME_ID
}

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyColorVariables(colors: ThemeColors): void {
  const root = document.documentElement
  // Reset all color vars first to prevent stale values from a previous theme
  for (const key of COLOR_VAR_KEYS) root.style.removeProperty(key)
  for (const [key, value] of Object.entries(colors)) {
    root.style.setProperty(key, value)
  }
}

function findTheme(id: string) {
  return colorThemes.find((t) => t.id === id) ?? colorThemes[0]
}

export function ThemeProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme())
  const [colorThemeId, setColorThemeIdState] = useState<ColorThemeId>(() => getStoredColorTheme())
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    const initialTheme = getStoredTheme()
    return initialTheme === 'system' ? getSystemTheme() : initialTheme
  })

  const setColorTheme = useCallback((id: ColorThemeId) => {
    if (!colorThemes.some((t) => t.id === id)) return
    setColorThemeIdState(id)
    localStorage.setItem('colorTheme', id)
  }, [])

  // Apply dark class + inject color variables whenever theme or colorTheme changes
  useEffect(() => {
    const root = document.documentElement
    const applyResolved = (next: ResolvedTheme): void => {
      root.classList.toggle('dark', next === 'dark')
      setResolvedTheme(next)
      const ct = findTheme(colorThemeId)
      applyColorVariables(next === 'dark' ? ct.dark : ct.light)
    }

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      applyResolved(mq.matches ? 'dark' : 'light')
      const handler = (e: MediaQueryListEvent): void => {
        applyResolved(e.matches ? 'dark' : 'light')
      }
      mq.addEventListener('change', handler)
      localStorage.setItem('theme', theme)
      return () => mq.removeEventListener('change', handler)
    }

    applyResolved(theme)
    localStorage.setItem('theme', theme)
    return undefined
  }, [theme, colorThemeId])

  return (
    <ThemeContext.Provider
      value={{ theme, resolvedTheme, setTheme, colorThemeId, setColorTheme }}
    >
      {children}
    </ThemeContext.Provider>
  )
}
