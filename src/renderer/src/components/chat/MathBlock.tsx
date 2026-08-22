import { useState, useEffect, memo } from 'react'
import { Copy, Check, Maximize2, AlertTriangle } from 'lucide-react'
import katex, { type TrustContext } from 'katex'
import { useTranslation } from 'react-i18next'
import { useCopyToClipboard } from '@renderer/hooks/useCopyToClipboard'
import { BlockToolbarBtn } from './BlockToolbarBtn'
import { ZoomablePreviewDialog } from './ZoomablePreviewDialog'

interface MathBlockProps {
  value: string
  displayMode: boolean
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

export const MathBlock = memo(function MathBlock({ value, displayMode }: MathBlockProps) {
  const { t } = useTranslation()
  const [html, setHtml] = useState('')
  const [error, setError] = useState('')
  const [showFullscreen, setShowFullscreen] = useState(false)
  const { copied: codeCopied, copy: copyCode } = useCopyToClipboard()

  useEffect(() => {
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
  }, [value, displayMode])

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
    return <span className="math-inline" dangerouslySetInnerHTML={{ __html: html }} />
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
              icon={Maximize2}
              tooltip={t('chat.math.fullscreen')}
              onClick={() => setShowFullscreen(true)}
            />
          </div>
        </div>
        <div className="overflow-x-auto p-4">
          <span className="math-display" dangerouslySetInnerHTML={{ __html: html }} />
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
