import { useCallback, useEffect, useRef, useState } from 'react'
import { RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react'
import {
  TransformComponent,
  TransformWrapper,
  type ReactZoomPanPinchRef,
} from 'react-zoom-pan-pinch'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import { BlockToolbarBtn } from './BlockToolbarBtn'

interface ZoomablePreviewDialogProps {
  children: React.ReactNode
  contentClassName?: string
  initialView?: 'actual' | 'fit'
  zoomInTooltip: string
  zoomOutTooltip: string
  zoomResetTooltip: string
  onClose: () => void
}

const MIN_SCALE = 0.25
const MAX_SCALE = 10
const BUTTON_ZOOM_STEP = 0.25
const WHEEL_ZOOM_STEP = 0.25
const ZOOM_ANIMATION_MS = 120
const CENTER_SCALE_THRESHOLD = 1

function stopPreviewWheel(event: WheelEvent): void {
  event.preventDefault()
  event.stopPropagation()
}

function centerZoomedOut(ref: ReactZoomPanPinchRef, animationTime = ZOOM_ANIMATION_MS): void {
  if (ref.state.scale <= CENTER_SCALE_THRESHOLD) {
    ref.centerView(ref.state.scale, animationTime)
  }
}

function getFitScale(ref: ReactZoomPanPinchRef): number {
  const wrapper = ref.instance.wrapperComponent
  const content = ref.instance.contentComponent
  if (!wrapper || !content) return 1

  const wrapperWidth = wrapper.clientWidth
  const wrapperHeight = wrapper.clientHeight
  const contentWidth = content.scrollWidth
  const contentHeight = content.scrollHeight
  if (wrapperWidth <= 0 || wrapperHeight <= 0 || contentWidth <= 0 || contentHeight <= 0) return 1

  return Math.min(
    MAX_SCALE,
    Math.max(MIN_SCALE, Math.min(wrapperWidth / contentWidth, wrapperHeight / contentHeight)),
  )
}

function applyInitialView(
  ref: ReactZoomPanPinchRef,
  initialView: 'actual' | 'fit',
  animationTime = 0,
): void {
  const nextScale = initialView === 'fit' ? getFitScale(ref) : 1
  ref.centerView(nextScale, animationTime)
}

export function ZoomablePreviewDialog({
  children,
  contentClassName = '',
  initialView = 'actual',
  zoomInTooltip,
  zoomOutTooltip,
  zoomResetTooltip,
  onClose,
}: ZoomablePreviewDialogProps): React.JSX.Element {
  const [scale, setScale] = useState(1)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  const handleZoomOut = useCallback(
    (zoomOut: ReactZoomPanPinchRef['zoomOut'], centerView: ReactZoomPanPinchRef['centerView']) => {
      const nextScale = Math.max(MIN_SCALE, scale - BUTTON_ZOOM_STEP)
      zoomOut(BUTTON_ZOOM_STEP, ZOOM_ANIMATION_MS)
      if (nextScale <= CENTER_SCALE_THRESHOLD) {
        centerView(nextScale, ZOOM_ANIMATION_MS)
      }
    },
    [scale],
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onCloseRef.current()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div
      data-zoomable-preview
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}>
      <div
        className="relative flex h-[92vh] w-[92vw] max-w-400 flex-col overflow-hidden rounded-xl bg-background"
        onClick={(event) => event.stopPropagation()}>
        <TransformWrapper
          minScale={MIN_SCALE}
          maxScale={MAX_SCALE}
          initialScale={1}
          centerOnInit
          centerZoomedOut
          limitToBounds={false}
          disablePadding
          smooth={false}
          wheel={{ step: WHEEL_ZOOM_STEP }}
          zoomAnimation={{ disabled: true, size: 0 }}
          panning={{ allowLeftClickPan: true, velocityDisabled: true }}
          doubleClick={{ disabled: true }}
          onInit={(ref) => {
            setScale(ref.state.scale)
            requestAnimationFrame(() => applyInitialView(ref, initialView))
          }}
          onWheel={(_, event) => stopPreviewWheel(event)}
          onWheelStop={(ref, event) => {
            stopPreviewWheel(event)
            centerZoomedOut(ref)
          }}
          onTransform={(_, state) => setScale(state.scale)}>
          {(transformRef) => (
            <>
              <div className="flex items-center justify-between border-b px-4 py-2">
                <div className="flex items-center gap-1">
                  <BlockToolbarBtn
                    icon={ZoomOut}
                    tooltip={zoomOutTooltip}
                    onClick={() => handleZoomOut(transformRef.zoomOut, transformRef.centerView)}
                  />
                  <span className="min-w-14 text-center text-xs text-muted-foreground">
                    {Math.round(scale * 100)}%
                  </span>
                  <BlockToolbarBtn
                    icon={ZoomIn}
                    tooltip={zoomInTooltip}
                    onClick={() => transformRef.zoomIn(BUTTON_ZOOM_STEP, ZOOM_ANIMATION_MS)}
                  />
                  <BlockToolbarBtn
                    icon={RotateCcw}
                    tooltip={zoomResetTooltip}
                    onClick={() => applyInitialView(transformRef, initialView, ZOOM_ANIMATION_MS)}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onClose}
                  aria-label="Close preview">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <TransformComponent
                wrapperClass="min-h-0 flex-1 !h-full !w-full touch-none cursor-grab bg-background active:cursor-grabbing"
                contentClass={cn('select-none p-8', contentClassName)}
                wrapperProps={{
                  onWheel: (event) => stopPreviewWheel(event.nativeEvent),
                }}>
                {children}
              </TransformComponent>
            </>
          )}
        </TransformWrapper>
      </div>
    </div>
  )
}
