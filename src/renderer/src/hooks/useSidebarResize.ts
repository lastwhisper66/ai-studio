import { useState, useCallback, useEffect, useRef } from 'react'

const MIN_WIDTH = 160
const MAX_WIDTH = 400
const DEFAULT_WIDTH = 224

export function useSidebarResize(
  storageKey: string,
  side: 'left' | 'right',
): { width: number; isResizing: boolean; handleMouseDown: (e: React.MouseEvent) => void } {
  const [width, setWidth] = useState(() => {
    const stored = localStorage.getItem(storageKey)
    const n = stored ? parseInt(stored, 10) : NaN
    return isNaN(n) ? DEFAULT_WIDTH : Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, n))
  })
  const [isResizing, setIsResizing] = useState(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)
  const widthRef = useRef(width)

  useEffect(() => {
    widthRef.current = width
  }, [width])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    startXRef.current = e.clientX
    startWidthRef.current = widthRef.current
    setIsResizing(true)
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const onMouseMove = (e: MouseEvent): void => {
      const delta = side === 'left' ? e.clientX - startXRef.current : startXRef.current - e.clientX
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidthRef.current + delta))
      widthRef.current = next
      setWidth(next)
    }

    const onMouseUp = (): void => {
      setIsResizing(false)
      localStorage.setItem(storageKey, String(widthRef.current))
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [isResizing, side, storageKey])

  return { width, isResizing, handleMouseDown }
}
