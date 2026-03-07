import { useState, useEffect, useRef } from 'react'

/**
 * Throttles a rapidly changing value using requestAnimationFrame.
 * When `isActive` is true, updates are batched to at most once per frame (~16ms).
 * When `isActive` is false, the value passes through immediately (via return).
 */
export function useThrottledValue<T>(value: T, isActive: boolean): T {
  const [throttled, setThrottled] = useState(value)
  const latestRef = useRef(value)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    latestRef.current = value
  })

  useEffect(() => {
    if (!isActive) {
      // Cancel any pending RAF — passthrough handled by return statement below
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      return
    }

    // Active — schedule RAF updates
    function tick(): void {
      setThrottled(latestRef.current)
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [isActive])

  return isActive ? throttled : value
}
