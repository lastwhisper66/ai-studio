import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { Copy, Check, Image, Maximize2, AlertTriangle } from 'lucide-react'
import katex, { type TrustContext } from 'katex'
import { useTranslation } from 'react-i18next'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { useCopyToClipboard } from '@renderer/hooks/useCopyToClipboard'
import { copySvgAsImage, sanitizeSvgMarkup } from '@renderer/lib/canvas'
import { BlockToolbarBtn } from './BlockToolbarBtn'
import { ZoomablePreviewDialog } from './ZoomablePreviewDialog'

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
        adaptor: {
          outerHTML: (node: unknown) => adaptor.outerHTML(node as never),
        },
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

  const copyImage = useCallback(async () => {
    try {
      await copySvgAsImage(await renderMathSvg(value, displayMode), {
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
        <div className="flex items-center justify-between border-b border-destructive/30 px-4 py-1.5 text-xs text-destructive">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>{t('chat.math.error')}</span>
          </div>
          <BlockToolbarBtn
            icon={codeCopied ? Check : Copy}
            tooltip={t('chat.math.copyCode')}
            onClick={() => copyCode(value)}
          />
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
      <div className="math-block my-3 overflow-hidden rounded-lg border bg-muted">
        <div className="flex items-center justify-between border-b px-4 py-1.5 text-xs text-muted-foreground">
          <span>math</span>
          <div className="flex items-center gap-0.5">
            <BlockToolbarBtn
              icon={codeCopied ? Check : Copy}
              tooltip={t('chat.math.copyCode')}
              onClick={() => copyCode(value)}
            />
            <BlockToolbarBtn
              icon={imgCopied ? Check : Image}
              tooltip={t('chat.math.copyImage')}
              onClick={copyImage}
            />
            <BlockToolbarBtn
              icon={Maximize2}
              tooltip={t('chat.math.fullscreen')}
              onClick={() => setShowFullscreen(true)}
            />
          </div>
        </div>
        <div className="overflow-x-auto p-4">
          <span
            ref={containerRef}
            className="math-display"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>

      {showFullscreen && (
        <ZoomablePreviewDialog
          zoomInTooltip={t('chat.math.zoomIn')}
          zoomOutTooltip={t('chat.math.zoomOut')}
          zoomResetTooltip={t('chat.math.zoomReset')}
          contentClassName="math-display text-2xl"
          onClose={() => setShowFullscreen(false)}>
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </ZoomablePreviewDialog>
      )}
    </>
  )
})
