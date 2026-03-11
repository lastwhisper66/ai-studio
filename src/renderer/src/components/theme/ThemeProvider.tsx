import { useEffect, useState, type ReactNode } from 'react'
import { ThemeContext, type ResolvedTheme, type Theme } from './ThemeContext'

function getStoredTheme(): Theme {
  const stored = localStorage.getItem('theme')
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'dark'
}

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme())
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    const initialTheme = getStoredTheme()
    return initialTheme === 'system' ? getSystemTheme() : initialTheme
  })

  useEffect(() => {
    const root = document.documentElement
    const applyResolvedTheme = (nextResolvedTheme: ResolvedTheme): void => {
      root.classList.toggle('dark', nextResolvedTheme === 'dark')
      setResolvedTheme(nextResolvedTheme)
    }

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      applyResolvedTheme(mq.matches ? 'dark' : 'light')
      const handler = (e: MediaQueryListEvent): void => {
        applyResolvedTheme(e.matches ? 'dark' : 'light')
      }
      mq.addEventListener('change', handler)
      localStorage.setItem('theme', theme)
      return () => mq.removeEventListener('change', handler)
    }

    applyResolvedTheme(theme)
    localStorage.setItem('theme', theme)
    return undefined
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>{children}</ThemeContext.Provider>
  )
}
