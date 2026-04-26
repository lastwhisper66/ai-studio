import { useState, useEffect, useRef, useCallback, memo } from 'react'
import {
  Copy,
  Check,
  Image,
  Maximize2,
  AlertTriangle,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react'
import katex, { type TrustContext } from 'katex'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { useCopyToClipboard } from '@renderer/hooks/useCopyToClipboard'
import { PORTABLE_IMAGE_OPTIONS, copySvgAsImage, sanitizeSvgMarkup } from '@renderer/lib/canvas'
import { BlockToolbarBtn } from './BlockToolbarBtn'

interface MathBlockProps {
  value: string
  displayMode: boolean
}

let mathjaxDocPromise: Promise<MathJaxDoc> | null = null

interface MathJaxDoc {
  convert(tex: string, options: { display: boolean }): unknown
  adaptor: { outerHTML(node: unknown): string }
}

function getMathJaxDoc(): Promise<MathJaxDoc> {
  if (!mathjaxDocPromise) {
    mathjaxDocPromise = (async () => {
      const { mathjax } = await import('mathjax-full/js/mathjax.js')
      const { TeX } = await import('mathjax-full/js/input/tex.js')
      const { SVG } = await import('mathjax-full/js/output/svg.js')
      const { liteAdaptor } = await import('mathjax-full/js/adaptors/liteAdaptor.js')
      const { RegisterHTMLHandler } = await import('mathjax-full/js/handlers/html.js')
      const { AllPackages } = await import('mathjax-full/js/input/tex/AllPackages.js')

      const adaptor = liteAdaptor()
      RegisterHTMLHandler(adaptor)

      const tex = new TeX({ packages: AllPackages })
      const svg = new SVG({ fontCache: 'none' })
      const doc = mathjax.document('', { InputJax: tex, OutputJax: svg })

      return {
        convert: (t: string, opts: { display: boolean }) => doc.convert(t, opts),
        adaptor: { outerHTML: (node: unknown) => adaptor.outerHTML(node as never) },
      }
    })()
  }
  return mathjaxDocPromise
}

const SAFE_URL_PROTOCOLS = new Set(['http', 'https', 'mailto'])

function isUrlTrustContext(
  context: TrustContext,
): context is Extract<TrustContext, { url: string }> {
  return context.command === '\\url' || context.command === '\\href'
}

function isSafeFormulaUrl(url: string, protocol?: string): boolean {
  const normalizedProtocol = protocol?.replace(/:$/, '').toLowerCase()
  if (normalizedProtocol) {
    return SAFE_URL_PROTOCOLS.has(normalizedProtocol)
  }

  try {
    return SAFE_URL_PROTOCOLS.has(new URL(url).protocol.replace(/:$/, '').toLowerCase())
  } catch {
    return false
  }
}

function shouldTrustFormulaCommand(context: TrustContext): boolean {
  return isUrlTrustContext(context) && isSafeFormulaUrl(context.url, context.protocol)
}

function sanitizeMathMarkup(markup: string): string {
  const template = document.createElement('template')
  template.innerHTML = markup

  template.content.querySelectorAll('*').forEach((el) => {
    const tagName = el.tagName.toLowerCase()
    if (tagName === 'script' || tagName === 'foreignobject') {
      el.remove()
      return
    }

    Array.from(el.attributes).forEach((attr) => {
      const attrName = attr.name.toLowerCase()
      if (attrName.startsWith('on')) {
        el.removeAttribute(attr.name)
        return
      }
      if ((attrName === 'href' || attrName === 'xlink:href') && !isSafeFormulaUrl(attr.value)) {
        el.removeAttribute(attr.name)
      }
    })
  })

  return template.innerHTML
}

async function renderMathSvg(value: string, displayMode: boolean): Promise<string> {
  const doc = await getMathJaxDoc()
  const node = doc.convert(value, { display: displayMode })
  return sanitizeSvgMarkup(doc.adaptor.outerHTML(node))
}

export const MathBlock = memo(function MathBlock({ value, displayMode }: MathBlockProps) {
  const { t } = useTranslation()
  const engine = useSettingsStore((s) => s.settings['display.mathEngine'] || 'katex')
  const [html, setHtml] = useState('')
  const [error, setError] = useState('')
  const [showFullscreen, setShowFullscreen] = useState(false)
  const [fullscreenScale, setFullscreenScale] = useState(1)
  const [imgCopied, setImgCopied] = useState(false)
  const containerRef = useRef<HTMLSpanElement>(null)
  const { copied: codeCopied, copy: copyCode } = useCopyToClipboard()

  useEffect(() => {
    let cancelled = false

    if (engine === 'mathjax') {
      getMathJaxDoc()
        .then((doc) => {
          const node = doc.convert(value, { display: displayMode })
          if (!cancelled) {
            setHtml(sanitizeMathMarkup(doc.adaptor.outerHTML(node)))
            setError('')
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setError(String(err?.message || err))
            setHtml('')
          }
        })
    } else {
      try {
        const rendered = katex.renderToString(value, {
          displayMode,
          throwOnError: false,
          output: 'htmlAndMathml',
          trust: shouldTrustFormulaCommand,
        })
        setHtml(sanitizeMathMarkup(rendered))
        setError('')
      } catch (err) {
        setError(String((err as Error)?.message || err))
        setHtml('')
      }
    }

    return () => {
      cancelled = true
    }
  }, [value, displayMode, engine])

  useEffect(() => {
    if (!showFullscreen) return
    setFullscreenScale(1)
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setShowFullscreen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showFullscreen])

  const handleFullscreenWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    setFullscreenScale((s) => Math.min(4, Math.max(0.25, s - e.deltaY * 0.001)))
  }, [])

  const copyImage = useCallback(async () => {
    try {
      await copySvgAsImage(await renderMathSvg(value, displayMode), {
        ...PORTABLE_IMAGE_OPTIONS,
        text: value,
        alt: value,
      })
      setImgCopied(true)
      setTimeout(() => setImgCopied(false), 2000)
    } catch (err) {
      console.warn('Copy math image failed:', err)
    }
  }, [displayMode, value])

  if (error) {
    if (!displayMode) {
      return (
        <code className="rounded border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 font-mono text-sm text-destructive">
          {value}
        </code>
      )
    }
    return (
      <div className="my-3 overflow-hidden rounded-lg border border-destructive/30 bg-muted">
        <div className="flex items-center gap-2 px-4 py-1.5 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>{t('chat.math.error')}</span>
        </div>
        <div className="p-3 text-xs text-destructive/80">{error}</div>
        <div className="border-t p-4">
          <pre className="text-sm">
            <code>{value}</code>
          </pre>
        </div>
      </div>
    )
  }

  if (!displayMode) {
    return (
      <span ref={containerRef} className="math-inline" dangerouslySetInnerHTML={{ __html: html }} />
    )
  }

  return (
    <>
      <div className="math-block group/math relative my-3 overflow-hidden rounded-lg border bg-muted">
        <div className="overflow-x-auto px-4 py-2">
          <span
            ref={containerRef}
            className="math-display"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
        <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 transition-opacity group-hover/math:opacity-100">
          <BlockToolbarBtn
            icon={codeCopied ? Check : Copy}
            tooltip={t('chat.math.copyCode')}
            className="bg-background/80 backdrop-blur-sm"
            onClick={() => copyCode(value)}
          />
          <BlockToolbarBtn
            icon={imgCopied ? Check : Image}
            tooltip={t('chat.math.copyImage')}
            className="bg-background/80 backdrop-blur-sm"
            onClick={copyImage}
          />
          <BlockToolbarBtn
            icon={Maximize2}
            tooltip={t('chat.math.fullscreen')}
            className="bg-background/80 backdrop-blur-sm"
            onClick={() => setShowFullscreen(true)}
          />
        </div>
      </div>

      {showFullscreen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setShowFullscreen(false)}
          onWheel={handleFullscreenWheel}>
          <div
            className="relative flex h-[92vh] w-[92vw] max-w-[1600px] flex-col overflow-hidden rounded-xl bg-background"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-4 py-2">
              <div className="flex items-center gap-1">
                <BlockToolbarBtn
                  icon={ZoomOut}
                  tooltip={t('chat.math.zoomOut')}
                  onClick={() => setFullscreenScale((s) => Math.max(0.25, s - 0.25))}
                />
                <span className="min-w-[3.5rem] text-center text-xs text-muted-foreground">
                  {Math.round(fullscreenScale * 100)}%
                </span>
                <BlockToolbarBtn
                  icon={ZoomIn}
                  tooltip={t('chat.math.zoomIn')}
                  onClick={() => setFullscreenScale((s) => Math.min(4, s + 0.25))}
                />
                <BlockToolbarBtn
                  icon={RotateCcw}
                  tooltip={t('chat.math.zoomReset')}
                  onClick={() => setFullscreenScale(1)}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowFullscreen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-8" onWheel={handleFullscreenWheel}>
              <div
                className="math-display inline-block min-w-full text-center text-2xl"
                style={{ zoom: fullscreenScale }}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
})
