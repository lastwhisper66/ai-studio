import type { BrowserWindow } from 'electron'
import { getSetting, setSetting } from '../db'

export interface WindowSizePersistorOptions {
  widthKey: string
  heightKey: string
  defaultWidth: number
  defaultHeight: number
  minWidth: number
  minHeight: number
  /** Prefix for console warnings when persistence fails (e.g. '[QuickAssistant]'). */
  logPrefix: string
  /** Debounce window for persist writes. Defaults to 300 ms. */
  debounceMs?: number
}

export interface WindowSizePersistor {
  /** Load the persisted size, falling back to defaults and clamping to minimums. */
  load: () => { width: number; height: number }
  /**
   * Hook resize / closed listeners onto the given window. Resize events are
   * debounced; `closed` clears the timer and snapshot. No-ops when the new
   * size matches the last persisted snapshot (e.g. programmatic setBounds).
   */
  attach: (win: BrowserWindow) => void
}

/**
 * Builds a self-contained size-persistence controller for a BrowserWindow.
 * Each controller owns its own debounce timer and last-persisted snapshot,
 * so multiple windows can coexist without cross-talk.
 */
export function createWindowSizePersistor(
  options: WindowSizePersistorOptions,
): WindowSizePersistor {
  const {
    widthKey,
    heightKey,
    defaultWidth,
    defaultHeight,
    minWidth,
    minHeight,
    logPrefix,
    debounceMs = 300,
  } = options

  let timer: ReturnType<typeof setTimeout> | null = null
  /**
   * In-memory snapshot of the most recent persisted size. `resize` fires both
   * for user drags and programmatic setBounds; we skip the persist path when
   * the new size equals this snapshot so repositioning on show does not queue
   * a redundant DB write.
   */
  let lastPersisted: { width: number; height: number } | null = null

  function load(): { width: number; height: number } {
    const rawW = Number(getSetting(widthKey))
    const rawH = Number(getSetting(heightKey))
    const width = Number.isFinite(rawW) && rawW >= minWidth ? Math.round(rawW) : defaultWidth
    const height = Number.isFinite(rawH) && rawH >= minHeight ? Math.round(rawH) : defaultHeight
    const size = { width, height }
    lastPersisted = size
    return size
  }

  function persist(width: number, height: number): void {
    if (lastPersisted && lastPersisted.width === width && lastPersisted.height === height) {
      return
    }
    lastPersisted = { width, height }
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      try {
        setSetting(widthKey, String(width))
        setSetting(heightKey, String(height))
      } catch (err) {
        console.warn(`${logPrefix} failed to persist size:`, err)
      }
    }, debounceMs)
  }

  function attach(win: BrowserWindow): void {
    win.on('resize', () => {
      if (win.isDestroyed()) return
      const [w, h] = win.getSize()
      persist(w, h)
    })
    win.on('closed', () => {
      if (timer) {
        clearTimeout(timer)
        timer = null
        // Flush the pending write synchronously so the last resize is not lost
        // when the app exits.
        if (lastPersisted) {
          try {
            setSetting(widthKey, String(lastPersisted.width))
            setSetting(heightKey, String(lastPersisted.height))
          } catch {
            /* ignore on shutdown */
          }
        }
      }
      lastPersisted = null
    })
  }

  return { load, attach }
}
