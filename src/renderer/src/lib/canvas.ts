interface SvgViewBox {
  x: number
  y: number
  width: number
  height: number
}

export interface SvgToPngOptions {
  scale?: number
  backgroundColor?: string
  foregroundColor?: string
  maxWidth?: number
  maxHeight?: number
  maxPixels?: number
}

interface ResolvedSvgToPngOptions {
  scale: number
  backgroundColor: string
  foregroundColor: string
  maxWidth: number
  maxHeight: number
  maxPixels: number
}

interface CopySvgAsImageOptions extends SvgToPngOptions {
  html?: string
  text?: string
  alt?: string
}

interface CopyImageMetadata {
  html?: string
  text?: string
  alt?: string
}

export const PORTABLE_IMAGE_OPTIONS = {
  backgroundColor: '#ffffff',
  foregroundColor: '#111111',
} as const

const DEFAULT_SVG_SCALE = 2
const DEFAULT_MAX_CANVAS_WIDTH = 8192
const DEFAULT_MAX_CANVAS_HEIGHT = 8192
const DEFAULT_MAX_CANVAS_PIXELS = 32_000_000
const MIN_RASTER_SCALE = 0.05

const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])
const FORBIDDEN_SVG_TAGS = new Set([
  'script',
  'foreignobject',
  'iframe',
  'object',
  'embed',
  'audio',
  'video',
  'canvas',
])

const SAFE_RASTER_DATA_URL = /^data:image\/(?:png|jpe?g|gif|webp);base64,/i

function parseViewBox(svgEl: SVGElement): SvgViewBox | null {
  const viewBox = svgEl.getAttribute('viewBox')
  if (!viewBox) return null

  const parts = viewBox
    .trim()
    .split(/[\s,]+/)
    .map((part) => parseFloat(part))
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return null

  const [x, y, width, height] = parts
  return width > 0 && height > 0 ? { x, y, width, height } : null
}

function parseSvgLength(value: string | null, fallback = 0): number {
  if (!value) return fallback

  const trimmed = value.trim()
  if (!trimmed || trimmed.endsWith('%')) return fallback

  const match = /^([+-]?\d*\.?\d+(?:e[+-]?\d+)?)([a-z]*)$/i.exec(trimmed)
  if (!match) return fallback

  const amount = parseFloat(match[1])
  if (!Number.isFinite(amount) || amount <= 0) return fallback

  const unit = match[2].toLowerCase()
  switch (unit) {
    case '':
    case 'px':
      return amount
    case 'in':
      return amount * 96
    case 'cm':
      return (amount * 96) / 2.54
    case 'mm':
      return (amount * 96) / 25.4
    case 'pt':
      return (amount * 96) / 72
    case 'pc':
      return amount * 16
    case 'em':
    case 'rem':
      return amount * 16
    case 'ex':
      return amount * 8
    default:
      return fallback
  }
}

function resolveCssColor(value: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback

  const trimmed = value.trim()
  if (!trimmed) return fallback

  const probe = document.createElement('span')
  probe.style.color = trimmed
  probe.style.display = 'none'
  document.body.appendChild(probe)
  const resolved = window.getComputedStyle(probe).color
  probe.remove()

  return resolved || fallback
}

function getThemeColor(cssVariable: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback

  const value = window.getComputedStyle(document.documentElement).getPropertyValue(cssVariable)
  return resolveCssColor(value || fallback, fallback)
}

function getThemeBackgroundColor(): string {
  return getThemeColor('--background', PORTABLE_IMAGE_OPTIONS.backgroundColor)
}

function getThemeForegroundColor(): string {
  return getThemeColor('--foreground', PORTABLE_IMAGE_OPTIONS.foregroundColor)
}

function isSafeSvgHref(value: string, tagName: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (trimmed.startsWith('#')) return true

  if (tagName === 'image') {
    return SAFE_RASTER_DATA_URL.test(trimmed)
  }

  try {
    const baseUrl = typeof document === 'undefined' ? 'https://local.invalid/' : document.baseURI
    return SAFE_LINK_PROTOCOLS.has(new URL(trimmed, baseUrl).protocol)
  } catch {
    return false
  }
}

function hasUnsafeCss(value: string): boolean {
  const compact = value.replace(/\s+/g, '').toLowerCase()
  if (
    compact.includes('@import') ||
    compact.includes('expression(') ||
    compact.includes('javascript:') ||
    compact.includes('vbscript:')
  ) {
    return true
  }

  for (const match of value.matchAll(/url\(([^)]*)\)/gi)) {
    const url = match[1].trim().replace(/^['"]|['"]$/g, '')
    if (url.startsWith('#') || SAFE_RASTER_DATA_URL.test(url)) continue
    return true
  }

  return false
}

function removeUnsafeSvgAttributes(el: Element, tagName: string): void {
  Array.from(el.attributes).forEach((attr) => {
    const attrName = attr.name.toLowerCase()
    const localName = attr.localName.toLowerCase()
    const value = attr.value.trim()

    if (attrName.startsWith('on')) {
      el.removeAttribute(attr.name)
      return
    }

    if (localName === 'href' || attrName === 'src') {
      if (!isSafeSvgHref(value, tagName)) el.removeAttribute(attr.name)
      return
    }

    if (attrName === 'style' && hasUnsafeCss(value)) {
      el.removeAttribute(attr.name)
      return
    }

    if (/java\s*script:|vb\s*script:/i.test(value)) {
      el.removeAttribute(attr.name)
    }
  })
}

export function sanitizeSvgMarkup(svgString: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgString, 'image/svg+xml')
  if (doc.querySelector('parsererror')) throw new Error('Invalid SVG')

  const svgEl = doc.querySelector('svg')
  if (!svgEl) throw new Error('Invalid SVG')

  const elements = [svgEl, ...Array.from(svgEl.querySelectorAll('*'))]
  elements.forEach((el) => {
    const tagName = el.tagName.toLowerCase()
    if (FORBIDDEN_SVG_TAGS.has(tagName)) {
      el.remove()
      return
    }

    if (tagName === 'style' && hasUnsafeCss(el.textContent || '')) {
      el.remove()
      return
    }

    removeUnsafeSvgAttributes(el, tagName)
  })

  svgEl.setAttribute('xmlns', svgEl.getAttribute('xmlns') || 'http://www.w3.org/2000/svg')
  svgEl.setAttribute(
    'xmlns:xlink',
    svgEl.getAttribute('xmlns:xlink') || 'http://www.w3.org/1999/xlink',
  )

  return new XMLSerializer().serializeToString(svgEl)
}

function normalizeSvgDimensions(
  svgString: string,
  foregroundColor: string,
): { svg: string; width: number; height: number } {
  const parser = new DOMParser()
  const doc = parser.parseFromString(sanitizeSvgMarkup(svgString), 'image/svg+xml')
  const svgEl = doc.querySelector('svg')
  if (!svgEl) throw new Error('Invalid SVG')

  const viewBox = parseViewBox(svgEl)
  let width = parseSvgLength(svgEl.getAttribute('width'))
  let height = parseSvgLength(svgEl.getAttribute('height'))

  if ((!width || !height) && viewBox) {
    if (!width && !height) {
      width = viewBox.width
      height = viewBox.height
    } else if (!width) {
      width = height * (viewBox.width / viewBox.height)
    } else {
      height = width * (viewBox.height / viewBox.width)
    }
  }

  if (!width || !height) {
    width = parseSvgLength(svgEl.style.maxWidth, 800)
    height = width * (viewBox ? viewBox.height / viewBox.width : 0.75)
  }

  svgEl.setAttribute('width', String(Math.ceil(width)))
  svgEl.setAttribute('height', String(Math.ceil(height)))
  svgEl.removeAttribute('style')
  svgEl.setAttribute('color', foregroundColor)
  svgEl.style.color = foregroundColor

  return {
    svg: new XMLSerializer().serializeToString(svgEl),
    width: Math.ceil(width),
    height: Math.ceil(height),
  }
}

function textToBase64(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  const chunkSize = 0x8000

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(i, i + chunkSize))
  }

  return btoa(binary)
}

function svgToDataUrl(svgString: string): string {
  return `data:image/svg+xml;base64,${textToBase64(svgString)}`
}

function resolvePositiveNumber(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

function resolveSvgToPngOptions(
  scaleOrOptions: number | SvgToPngOptions = DEFAULT_SVG_SCALE,
  backgroundColor?: string,
): ResolvedSvgToPngOptions {
  if (typeof scaleOrOptions === 'number') {
    return {
      scale: resolvePositiveNumber(scaleOrOptions, DEFAULT_SVG_SCALE),
      backgroundColor: backgroundColor ?? getThemeBackgroundColor(),
      foregroundColor: getThemeForegroundColor(),
      maxWidth: DEFAULT_MAX_CANVAS_WIDTH,
      maxHeight: DEFAULT_MAX_CANVAS_HEIGHT,
      maxPixels: DEFAULT_MAX_CANVAS_PIXELS,
    }
  }

  return {
    scale: resolvePositiveNumber(scaleOrOptions.scale, DEFAULT_SVG_SCALE),
    backgroundColor: scaleOrOptions.backgroundColor ?? getThemeBackgroundColor(),
    foregroundColor: scaleOrOptions.foregroundColor ?? getThemeForegroundColor(),
    maxWidth: resolvePositiveNumber(scaleOrOptions.maxWidth, DEFAULT_MAX_CANVAS_WIDTH),
    maxHeight: resolvePositiveNumber(scaleOrOptions.maxHeight, DEFAULT_MAX_CANVAS_HEIGHT),
    maxPixels: resolvePositiveNumber(scaleOrOptions.maxPixels, DEFAULT_MAX_CANVAS_PIXELS),
  }
}

function resolveRasterScale(
  width: number,
  height: number,
  options: ResolvedSvgToPngOptions,
): number {
  const widthScale = options.maxWidth / Math.max(width, 1)
  const heightScale = options.maxHeight / Math.max(height, 1)
  const pixelScale = Math.sqrt(options.maxPixels / Math.max(width * height, 1))
  return Math.max(MIN_RASTER_SCALE, Math.min(options.scale, widthScale, heightScale, pixelScale))
}

export async function svgToPngBlob(
  svgString: string,
  scaleOrOptions: number | SvgToPngOptions = DEFAULT_SVG_SCALE,
  backgroundColor?: string,
): Promise<Blob> {
  const options = resolveSvgToPngOptions(scaleOrOptions, backgroundColor)
  const { svg, width, height } = normalizeSvgDimensions(svgString, options.foregroundColor)
  const rasterScale = resolveRasterScale(width, height, options)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  const img = new window.Image()
  const url = svgToDataUrl(svg)

  await new Promise<void>((resolve, reject) => {
    img.onload = () => {
      canvas.width = Math.max(1, Math.ceil(width * rasterScale))
      canvas.height = Math.max(1, Math.ceil(height * rasterScale))
      if (options.backgroundColor !== 'transparent') {
        ctx.fillStyle = options.backgroundColor
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
      ctx.scale(rasterScale, rasterScale)
      ctx.drawImage(img, 0, 0, width, height)
      resolve()
    }
    img.onerror = () => {
      reject(new Error('SVG image decode failed'))
    }
    img.src = url
  })

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
  )
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  window.setTimeout(() => {
    a.remove()
    URL.revokeObjectURL(url)
  }, 1000)
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      resolve(result.includes(',') ? result.slice(result.indexOf(',') + 1) : result)
    }
    reader.onerror = () => reject(reader.error || new Error('Blob read failed'))
    reader.readAsDataURL(blob)
  })
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function createImageHtml(dataUrl: string, alt?: string): string {
  const altAttr = alt ? ` alt="${escapeHtmlAttribute(alt)}"` : ''
  return `<img src="${dataUrl}"${altAttr}>`
}

function copyImageHtmlDataUrl(dataUrl: string, metadata: CopyImageMetadata = {}): boolean {
  const listener = (event: ClipboardEvent): void => {
    event.preventDefault()
    event.clipboardData?.setData(
      'text/html',
      metadata.html ?? createImageHtml(dataUrl, metadata.alt),
    )
    event.clipboardData?.setData('text/plain', metadata.text ?? dataUrl)
  }

  document.addEventListener('copy', listener, { once: true })
  const copied = document.execCommand('copy')
  document.removeEventListener('copy', listener)
  return copied
}

async function copyPngBlobAsImage(blob: Blob, metadata: CopyImageMetadata = {}): Promise<void> {
  const base64 = await blobToBase64(blob)
  const dataUrl = `data:${blob.type || 'image/png'};base64,${base64}`
  const html = metadata.html ?? createImageHtml(dataUrl, metadata.alt)
  const text = metadata.text ?? dataUrl

  if (window.api?.copyPngToClipboard) {
    const result = await window.api.copyPngToClipboard({ pngBase64: base64, html, text })
    if (result.success) return
    console.warn('Electron image clipboard write failed:', result.error)
  }

  if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    try {
      const itemData: Record<string, Blob> = {
        'image/png': blob,
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      }
      await navigator.clipboard.write([new ClipboardItem(itemData)])
      return
    } catch (err) {
      console.warn('Browser image clipboard write failed:', err)
    }
  }

  const copiedHtml = copyImageHtmlDataUrl(dataUrl, { ...metadata, html, text })
  if (!copiedHtml) {
    throw new Error('Image clipboard API unavailable')
  }
}

export async function copySvgAsImage(
  svgString: string,
  options?: CopySvgAsImageOptions,
): Promise<void> {
  try {
    await copyPngBlobAsImage(await svgToPngBlob(svgString, options), options)
  } catch (err) {
    console.warn('PNG clipboard copy failed, falling back to SVG HTML:', err)
    const resolvedOptions = resolveSvgToPngOptions(options)
    const { svg } = normalizeSvgDimensions(svgString, resolvedOptions.foregroundColor)
    const copiedHtml = copyImageHtmlDataUrl(svgToDataUrl(svg), options)
    if (!copiedHtml) throw err
  }
}

export async function saveBlobAsFile(
  blob: Blob,
  defaultPath: string,
  filters?: { name: string; extensions: string[] }[],
): Promise<boolean> {
  if (window.api?.saveFile) {
    const result = await window.api.saveFile({
      base64: await blobToBase64(blob),
      defaultPath,
      filters,
    })
    if (result.success) return result.data ?? false
    throw new Error(result.error ? JSON.stringify(result.error) : 'Save file failed')
  }

  downloadBlob(blob, defaultPath)
  return true
}
