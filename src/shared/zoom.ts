export const ZOOM_STEP = 0.1
export const ZOOM_MIN = 0.5
export const ZOOM_MAX = 2.0
export const ZOOM_DEFAULT = 1.0

export function clampZoom(factor: number): number {
  return Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, factor)) * 100) / 100
}
