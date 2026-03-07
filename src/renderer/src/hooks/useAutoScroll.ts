import { useRef, useState, useCallback, useEffect, type DependencyList } from 'react'

interface UseAutoScrollReturn {
  scrollRef: React.RefObject<HTMLDivElement | null>
  sentinelRef: React.RefObject<HTMLDivElement | null>
  isAtBottom: boolean
  scrollToBottom: () => void
}

export function useAutoScroll(deps: DependencyList = []): UseAutoScrollReturn {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const isAtBottomRef = useRef(true)

  // Use IntersectionObserver to track whether the sentinel is visible
  useEffect(() => {
    const sentinel = sentinelRef.current
    const viewport = scrollRef.current
    if (!sentinel || !viewport) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        isAtBottomRef.current = entry.isIntersecting
        setIsAtBottom(entry.isIntersecting)
      },
      { root: viewport, threshold: 0.1 },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  // Auto-scroll when dependencies change and user is at bottom.
  // Uses ref to avoid stale closure — isAtBottom state may lag behind the observer callback.
  useEffect(() => {
    if (isAtBottomRef.current) {
      sentinelRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps

  const scrollToBottom = useCallback(() => {
    sentinelRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  return { scrollRef, sentinelRef, isAtBottom, scrollToBottom }
}
