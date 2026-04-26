import { useEffect, useState, useCallback } from 'react'
import {
  Check,
  Sun,
  Moon,
  Monitor,
  RotateCcw,
  ChevronsUpDown,
  Type,
  Code,
  Minus,
  Plus,
  Sigma,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@renderer/hooks/useTheme'
import { colorThemes } from '@renderer/components/theme/themes'
import type { Theme } from '@renderer/components/theme/ThemeContext'
import { cn } from '@renderer/lib/utils'
import { Button } from '@renderer/components/ui/button'
import { Label } from '@renderer/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@renderer/components/ui/command'
import { useSettingsStore } from '@renderer/stores/settingsStore'

const modeOptions: { value: Theme; icon: typeof Sun }[] = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
  { value: 'system', icon: Monitor },
]

export function DisplaySection(): React.JSX.Element {
  const { t } = useTranslation()
  const { theme, setTheme, colorThemeId, setColorTheme, resolvedTheme } = useTheme()
  const { settings, saveSettings } = useSettingsStore()

  // ── Zoom state ──
  const [zoomPercent, setZoomPercent] = useState(100)

  useEffect(() => {
    window.api.getZoom().then((factor) => setZoomPercent(Math.round(factor * 100)))
    const cleanup = window.api.onZoomChanged((factor) => setZoomPercent(Math.round(factor * 100)))
    return cleanup
  }, [])

  const handleZoomStep = useCallback(
    (delta: number) => {
      setZoomPercent((prev) => {
        const next = Math.max(50, Math.min(200, prev + delta))
        saveSettings({ 'display.zoomFactor': String(next / 100) })
        return next
      })
    },
    [saveSettings],
  )

  const handleZoomReset = useCallback(() => {
    setZoomPercent(100)
    saveSettings({ 'display.zoomFactor': '1' })
  }, [saveSettings])

  // ── Font state ──
  const [systemFonts, setSystemFonts] = useState<string[]>([])
  const fontFamily = settings['display.fontFamily'] ?? ''
  const codeFontFamily = settings['display.codeFontFamily'] ?? ''
  const [fontOpen, setFontOpen] = useState(false)
  const [codeFontOpen, setCodeFontOpen] = useState(false)

  useEffect(() => {
    window.api.getSystemFonts().then((result) => {
      if (result.success && result.data) setSystemFonts(result.data)
    })
  }, [])

  const handleFontChange = useCallback(
    (value: string) => {
      setFontOpen(false)
      saveSettings({ 'display.fontFamily': value })
    },
    [saveSettings],
  )

  const handleCodeFontChange = useCallback(
    (value: string) => {
      setCodeFontOpen(false)
      saveSettings({ 'display.codeFontFamily': value })
    },
    [saveSettings],
  )

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
              )}>
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
                )}>
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
                <span className="text-xs font-medium">{t(`settings.display.themes.${ct.id}`)}</span>
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

      {/* ── Zoom ── */}
      <div className="rounded-xl border bg-card/50 p-5">
        <h3 className="mb-4 text-sm font-medium">{t('settings.display.zoom')}</h3>
        <div className="flex items-center justify-between gap-4">
          <p className="text-muted-foreground text-xs">{t('settings.display.zoomHint')}</p>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleZoomStep(-10)}
              disabled={zoomPercent <= 50}>
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-14 text-center text-sm font-medium tabular-nums select-none">
              {zoomPercent}%
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleZoomStep(10)}
              disabled={zoomPercent >= 200}>
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleZoomReset}
              disabled={zoomPercent === 100}
              title={t('settings.display.zoomReset')}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Fonts ── */}
      <div className="rounded-xl border bg-card/50 p-5">
        <h3 className="mb-4 text-sm font-medium">{t('settings.display.fonts')}</h3>
        <div className="space-y-4">
          {/* Global font */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Type className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <div>
                <Label className="text-sm font-medium">{t('settings.display.fontFamily')}</Label>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {t('settings.display.fontFamilyHint')}
                </p>
              </div>
            </div>
            <FontCombobox
              value={fontFamily}
              fonts={systemFonts}
              open={fontOpen}
              onOpenChange={setFontOpen}
              onSelect={handleFontChange}
              placeholder={t('settings.display.fontDefault')}
              emptyText={t('settings.display.fontNotFound')}
            />
          </div>

          {/* Code font */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Code className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <div>
                <Label className="text-sm font-medium">
                  {t('settings.display.codeFontFamily')}
                </Label>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {t('settings.display.codeFontFamilyHint')}
                </p>
              </div>
            </div>
            <FontCombobox
              value={codeFontFamily}
              fonts={systemFonts}
              open={codeFontOpen}
              onOpenChange={setCodeFontOpen}
              onSelect={handleCodeFontChange}
              placeholder={t('settings.display.fontDefault')}
              emptyText={t('settings.display.fontNotFound')}
            />
          </div>
        </div>
      </div>

      {/* ── Math Engine ── */}
      <div className="rounded-xl border bg-card/50 p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Sigma className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <div>
              <Label className="text-sm font-medium">{t('settings.display.mathEngine')}</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {t('settings.display.mathEngineHint')}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {(['katex', 'mathjax'] as const).map((eng) => (
              <button
                key={eng}
                type="button"
                aria-pressed={(settings['display.mathEngine'] || 'katex') === eng}
                onClick={() => saveSettings({ 'display.mathEngine': eng })}
                className={cn(
                  'rounded-lg border px-4 py-2 text-sm transition-colors',
                  (settings['display.mathEngine'] || 'katex') === eng
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border hover:bg-accent text-muted-foreground',
                )}>
                {t(`settings.display.mathEngine${eng === 'katex' ? 'Katex' : 'Mathjax'}`)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Font Combobox ──────────────────────────────────────────────

interface FontComboboxProps {
  value: string
  fonts: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (value: string) => void
  placeholder: string
  emptyText: string
}

function FontCombobox({
  value,
  fonts,
  open,
  onOpenChange,
  onSelect,
  placeholder,
  emptyText,
}: FontComboboxProps): React.JSX.Element {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between text-sm font-normal">
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="end">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {/* Default option to clear */}
              <CommandItem value="__default__" onSelect={() => onSelect('')}>
                <Check className={cn('mr-2 h-4 w-4', !value ? 'opacity-100' : 'opacity-0')} />
                {placeholder}
              </CommandItem>
              {fonts.map((font) => (
                <CommandItem key={font} value={font} onSelect={() => onSelect(font)}>
                  <Check
                    className={cn('mr-2 h-4 w-4', value === font ? 'opacity-100' : 'opacity-0')}
                  />
                  <span style={{ fontFamily: `"${font}"` }}>{font}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
