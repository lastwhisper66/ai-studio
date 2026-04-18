import { useState, useEffect } from 'react'

/**
 * Tracks elapsed time from a given start timestamp.
 * Returns 0 when startTime is null/undefined.
 * Updates every 100ms while active.
 */
export function useElapsedTime(startTime: number | null | undefined): number {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!startTime) return
    const update = (): void => setElapsed(Date.now() - startTime)
    update()
    const timer = setInterval(update, 100)
    return () => clearInterval(timer)
  }, [startTime])
  return startTime ? elapsed : 0
}
