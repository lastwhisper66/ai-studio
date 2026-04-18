import { useState, useEffect, useRef, useCallback } from 'react'
import type { ScreenshotData } from '@shared/types'

interface Selection {
  startX: number
  startY: number
  endX: number
  endY: number
}

export function ScreenshotApp(): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [screenshotData, setScreenshotData] = useState<ScreenshotData | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const imageRef = useRef<HTMLImageElement | null>(null)

  // Listen for screenshot data from main process
  useEffect(() => {
    const unsub = window.api.onScreenshotData((data: ScreenshotData) => {
      setScreenshotData(data)
    })
    return () => unsub()
  }, [])

  const drawCanvas = useCallback(
    (img: HTMLImageElement, sel: Selection | null) => {
      const canvas = canvasRef.current
      if (!canvas || !screenshotData) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Draw the screenshot scaled to display size
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      // Draw semi-transparent overlay
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      if (sel) {
        const x = Math.min(sel.startX, sel.endX)
        const y = Math.min(sel.startY, sel.endY)
        const w = Math.abs(sel.endX - sel.startX)
        const h = Math.abs(sel.endY - sel.startY)

        if (w > 0 && h > 0) {
          // Clear the selected region to show original brightness
          ctx.save()
          ctx.beginPath()
          ctx.rect(x, y, w, h)
          ctx.clip()
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          ctx.restore()

          // Draw selection border
          ctx.strokeStyle = '#4A90D9'
          ctx.lineWidth = 2
          ctx.strokeRect(x, y, w, h)

          // Draw dimension label
          const scaleFactor = screenshotData.scaleFactor
          const realW = Math.round(w * scaleFactor)
          const realH = Math.round(h * scaleFactor)
          const label = `${realW} × ${realH}`
          ctx.font = '12px sans-serif'
          const metrics = ctx.measureText(label)
          const labelX = x
          const labelY = y > 24 ? y - 6 : y + h + 18
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
          ctx.fillRect(labelX, labelY - 14, metrics.width + 8, 20)
          ctx.fillStyle = '#fff'
          ctx.fillText(label, labelX + 4, labelY)
        }
      }
    },
    [screenshotData],
  )

  // Load image and draw initial canvas when screenshot data arrives
  useEffect(() => {
    if (!screenshotData || !canvasRef.current) return

    const canvas = canvasRef.current
    canvas.width = screenshotData.displayWidth
    canvas.height = screenshotData.displayHeight

    const img = new Image()
    img.onload = (): void => {
      imageRef.current = img
      drawCanvas(img, null)
    }
    img.src = `data:image/png;base64,${screenshotData.base64}`
  }, [screenshotData, drawCanvas])

  // Redraw on selection change
  useEffect(() => {
    if (imageRef.current) {
      drawCanvas(imageRef.current, selection)
    }
  }, [selection, drawCanvas])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!screenshotData) return
      setIsSelecting(true)
      setSelection({
        startX: e.clientX,
        startY: e.clientY,
        endX: e.clientX,
        endY: e.clientY,
      })
    },
    [screenshotData],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isSelecting) return
      setSelection((prev) => (prev ? { ...prev, endX: e.clientX, endY: e.clientY } : null))
    },
    [isSelecting],
  )

  const handleMouseUp = useCallback(() => {
    if (!isSelecting || !selection) return
    setIsSelecting(false)

    const x = Math.min(selection.startX, selection.endX)
    const y = Math.min(selection.startY, selection.endY)
    const w = Math.abs(selection.endX - selection.startX)
    const h = Math.abs(selection.endY - selection.startY)

    if (w < 5 || h < 5) {
      // Too small — treat as a click, cancel
      setSelection(null)
      return
    }

    // Send selection coordinates to main process
    window.api.screenshotComplete({ x, y, width: w, height: h })
  }, [isSelecting, selection])

  // ESC to cancel
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        window.api.screenshotCancel()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        cursor: 'crosshair',
      }}
    />
  )
}
