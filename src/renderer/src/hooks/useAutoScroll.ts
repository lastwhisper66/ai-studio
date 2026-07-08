import { useRef, useState, useCallback, useEffect, type DependencyList } from 'react'

interface UseAutoScrollReturn {
  scrollRef: React.RefObject<HTMLDivElement | null>
  sentinelRef: React.RefObject<HTMLDivElement | null>
  isAtBottom: boolean
  scrollToBottom: () => void
}

// Treat the viewport as "at the bottom" when within this many px of the end.
// Forgiving enough for sub-pixel rounding and a bit of momentum, small enough
// that a deliberate scroll-up always clears it.
const BOTTOM_THRESHOLD = 32

export function useAutoScroll(deps: DependencyList = []): UseAutoScrollReturn {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  // Retained for the bottom marker rendered by MessageList (public API compat).
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  // Whether auto-scroll is currently "armed" (following the bottom). Kept in a
  // ref so the streaming effect reads the latest value synchronously, without
  // waiting for a re-render or an async observer callback.
  const stickRef = useRef(true)
  const lastTopRef = useRef(0)

  const setStick = useCallback((next: boolean): void => {
    if (stickRef.current !== next) {
      stickRef.current = next
      setIsAtBottom(next)
    }
  }, [])

  // Track the user's scroll intent directly from the viewport.
  //   - Re-arm when the viewport reaches the bottom (user scrolled back down,
  //     or a programmatic follow-scroll landed there).
  //   - Disarm the instant the user scrolls up and away from the bottom.
  // Auto-scroll only ever moves *down* (toward the end), so any upward movement
  // that isn't already at the bottom is user-initiated. Reading scrollTop
  // direction catches the scrollbar thumb, touch drags and keyboard scrolling;
  // the wheel listener additionally disarms *synchronously* (before the scroll
  // it triggers) so a fast content stream can never drag the user back down.
  useEffect(() => {
    const viewport = scrollRef.current
    if (!viewport) return

    lastTopRef.current = viewport.scrollTop

    const onScroll = (): void => {
      const top = viewport.scrollTop
      const dist = viewport.scrollHeight - top - viewport.clientHeight
      if (dist <= BOTTOM_THRESHOLD) {
        setStick(true)
      } else if (top < lastTopRef.current - 1) {
        setStick(false)
      }
      lastTopRef.current = top
    }

    const onWheel = (event: WheelEvent): void => {
      if (event.deltaY >= 0) return
      // Pre-emptively stop following (ref only) so a fast content stream can't
      // drag the user back down before the scroll it triggers is handled.
      // onScroll owns the isAtBottom UI state and reconciles it from the real
      // position moments later — including re-arming if this was a tiny nudge
      // that stayed within the bottom zone, which avoids a button flicker.
      // Guarded by an overflow check: a wheel over non-overflowing content
      // produces no scroll event, so we must not strand ourselves disarmed.
      if (viewport.scrollHeight > viewport.clientHeight + BOTTOM_THRESHOLD) {
        stickRef.current = false
      }
    }

    viewport.addEventListener('scroll', onScroll, { passive: true })
    viewport.addEventListener('wheel', onWheel, { passive: true })
    return () => {
      viewport.removeEventListener('scroll', onScroll)
      viewport.removeEventListener('wheel', onWheel)
    }
  }, [setStick])

  // Follow the bottom when new content/messages arrive, but only while armed.
  // Uses instant ('auto') scrolling: at ~60fps during streaming a smooth scroll
  // would restart an animation every frame and keep gliding after the user
  // grabs the scrollbar, which is exactly what causes the scroll fight.
  useEffect(() => {
    if (!stickRef.current) return
    const viewport = scrollRef.current
    if (!viewport) return
    viewport.scrollTo({ top: viewport.scrollHeight })
  }, [...deps]) // eslint-disable-line react-hooks/exhaustive-deps

  const scrollToBottom = useCallback((): void => {
    const viewport = scrollRef.current
    if (!viewport) return
    setStick(true)
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' })
  }, [setStick])

  return { scrollRef, sentinelRef, isAtBottom, scrollToBottom }
}
