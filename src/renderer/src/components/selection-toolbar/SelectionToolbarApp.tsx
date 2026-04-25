import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SelectionToolbarPayload } from '@shared/types'
import { useSeedTranslator } from '@renderer/hooks/useSeedTranslator'
import i18n from '@renderer/i18n'
import { defaultSelectionActionIcon, selectionActionIconMap } from './icons'

export function SelectionToolbarApp(): React.JSX.Element {
  const { t } = useTranslation()
  const [payload, setPayload] = useState<SelectionToolbarPayload | null>(null)
  const readySignalled = useRef(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const lastReportedWidth = useRef(0)
  const st = useSeedTranslator()

  useEffect(() => {
    const unsubscribe = window.api.onSelectionToolbarData((data) => {
      setPayload(data)
    })
    if (!readySignalled.current) {
      readySignalled.current = true
      window.api.selectionToolbarReady()
    }
    return unsubscribe
  }, [])

  // This window is pre-created at app startup; its i18n instance is seeded
  // once from localStorage and won't observe later `changeLanguage` calls in
  // the main app window. Main process broadcasts language changes so we can
  // keep the toolbar's labels in sync without restarting.
  useEffect(() => {
    return window.api.onLanguageChanged((lang) => {
      i18n.changeLanguage(lang)
    })
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        window.api.selectionToolbarClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Measure the toolbar's intrinsic content width and report it to the main
  // process so the BrowserWindow can tighten itself around the buttons. The
  // container uses `w-max` so it sizes to content inside a wider (opacity-0)
  // host window, then we report after layout — no character-width heuristic
  // needed, so Chinese/English/custom-name widths are all pixel-accurate.
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const report = (): void => {
      const rect = el.getBoundingClientRect()
      // +1 covers sub-pixel rounding; the border is already inside rect.width.
      const next = Math.ceil(rect.width) + 1
      if (next > 0 && next !== lastReportedWidth.current) {
        lastReportedWidth.current = next
        window.api.selectionToolbarResize(next)
      }
    }
    report()
    // Re-measure if webfonts finish loading after first paint and shift the
    // label width. ResizeObserver also catches label changes from late
    // language-change broadcasts.
    const ro = new ResizeObserver(report)
    ro.observe(el)
    return () => ro.disconnect()
  }, [payload])

  const actions = payload?.actions ?? []

  return (
    <div className="flex h-screen items-center justify-start">
      <div
        ref={containerRef}
        className="bg-background text-foreground flex h-full w-max items-center gap-0.5 overflow-hidden rounded-xl border px-1.5">
        {actions.length === 0 ? (
          <span className="text-muted-foreground px-2 text-xs">
            {t('settings.selectionAssistant.toolbar.waitingSelection')}
          </span>
        ) : (
          actions.map((action) => {
            const Icon = selectionActionIconMap[action.icon] ?? defaultSelectionActionIcon
            return (
              <button
                key={action.id}
                title={st(action.description) || st(action.name)}
                aria-label={st(action.name)}
                onMouseDown={(e) => {
                  // mousedown (not click) so we trigger before blur-induced hide
                  e.preventDefault()
                  window.api.selectionToolbarAction(action.id)
                }}
                className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-2 text-xs transition-colors">
                <Icon className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">{st(action.name)}</span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
