import { Check, Sun, Moon, Monitor } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@renderer/hooks/useTheme'
import { colorThemes } from '@renderer/components/theme/themes'
import type { Theme } from '@renderer/components/theme/ThemeContext'
import { cn } from '@renderer/lib/utils'

const modeOptions: { value: Theme; icon: typeof Sun }[] = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
  { value: 'system', icon: Monitor },
]

export function DisplaySection(): React.JSX.Element {
  const { t } = useTranslation()
  const { theme, setTheme, colorThemeId, setColorTheme, resolvedTheme } = useTheme()

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-card/50 p-5">
        <h2 className="text-base font-semibold">{t('settings.display.title')}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t('settings.display.description')}</p>
      </div>

      {/* ── Mode selector ── */}
      <div className="rounded-xl border bg-card/50 p-5">
        <h3 className="mb-3 text-sm font-medium">{t('settings.display.mode')}</h3>
        <div className="flex gap-2">
          {modeOptions.map(({ value, icon: Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={theme === value}
              onClick={() => setTheme(value)}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors',
                theme === value
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'border-border hover:bg-accent text-muted-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {t(`settings.display.${value}`)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Color theme grid ── */}
      <div className="rounded-xl border bg-card/50 p-5">
        <h3 className="mb-3 text-sm font-medium">{t('settings.display.colorTheme')}</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {colorThemes.map((ct) => {
            const isActive = ct.id === colorThemeId
            const previewMode = resolvedTheme === 'dark' ? 'dark' : 'light'
            const [primary, secondary, accent] = ct.preview[previewMode]
            return (
              <button
                key={ct.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => setColorTheme(ct.id)}
                className={cn(
                  'group relative flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all',
                  isActive
                    ? 'border-primary bg-primary/5 ring-primary/20 ring-2'
                    : 'border-border hover:border-primary/40 hover:bg-accent/50',
                )}
              >
                {/* Color preview dots */}
                <div className="flex gap-1.5">
                  <span
                    className="h-5 w-5 rounded-full border border-foreground/10"
                    style={{ background: primary }}
                  />
                  <span
                    className="h-5 w-5 rounded-full border border-foreground/10"
                    style={{ background: secondary }}
                  />
                  <span
                    className="h-5 w-5 rounded-full border border-foreground/10"
                    style={{ background: accent }}
                  />
                </div>
                <span className="text-xs font-medium">
                  {t(`settings.display.themes.${ct.id}`)}
                </span>
                {isActive && (
                  <span className="bg-primary text-primary-foreground absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
