import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { Copy, Check, Image, Maximize2, Columns2, Download, AlertTriangle } from 'lucide-react'
import mermaid from 'mermaid'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { useTheme } from '@renderer/hooks/useTheme'
import { useCopyToClipboard } from '@renderer/hooks/useCopyToClipboard'
import { highlightCode } from '@renderer/lib/shiki'
import {
  PORTABLE_IMAGE_OPTIONS,
  sanitizeSvgMarkup,
  svgToPngBlob,
  copySvgAsImage,
  saveBlobAsFile,
} from '@renderer/lib/canvas'
import { BlockToolbarBtn } from './BlockToolbarBtn'
import { ZoomablePreviewDialog } from './ZoomablePreviewDialog'

interface MermaidBlockProps {
  code: string
  isStreaming?: boolean
}

let mermaidId = 0
let lastMermaidTheme: string | null = null

function ensureMermaidInit(theme: 'default' | 'dark'): void {
  if (lastMermaidTheme !== theme) {
    mermaid.initialize({
      startOnLoad: false,
      theme,
      securityLevel: 'strict',
      htmlLabels: false,
      flowchart: { htmlLabels: false },
    })
    lastMermaidTheme = theme
  }
}

async function renderMermaidSvg(code: string, theme: 'default' | 'dark'): Promise<string> {
  ensureMermaidInit(theme)
  const { svg: renderedSvg } = await mermaid.render(`mermaid-${++mermaidId}`, code)
  return sanitizeSvgMarkup(renderedSvg)
}

export const MermaidBlock = memo(function MermaidBlock({ code, isStreaming }: MermaidBlockProps) {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [showCompare, setShowCompare] = useState(false)
  const [showFullscreen, setShowFullscreen] = useState(false)
  const [highlightedCode, setHighlightedCode] = useState('')
  const [imgCopied, setImgCopied] = useState(false)
  const svgContainerRef = useRef<HTMLDivElement>(null)
  const { copied: codeCopied, copy: copyCode } = useCopyToClipboard()

  const mermaidTheme = resolvedTheme === 'dark' ? 'dark' : 'default'

  useEffect(() => {
    if (isStreaming) return

    let cancelled = false
    renderMermaidSvg(code, mermaidTheme)
      .then((renderedSvg) => {
        if (!cancelled) {
          setSvg(renderedSvg)
          setError('')
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(String(err?.message || err))
          setSvg('')
        }
      })

    return () => {
      cancelled = true
    }
  }, [code, isStreaming, mermaidTheme])

  useEffect(() => {
    if (!showCompare) return
    let cancelled = false
    const shikiTheme = resolvedTheme === 'light' ? 'github-light' : 'github-dark'
    highlightCode(code, 'mermaid', shikiTheme).then((html) => {
      if (!cancelled) setHighlightedCode(html)
    })
    return () => {
      cancelled = true
    }
  }, [showCompare, code, resolvedTheme])

  const copyImage = useCallback(async () => {
    if (!svg) return
    try {
      const themedSvg = await renderMermaidSvg(code, mermaidTheme)
      await copySvgAsImage(themedSvg, {
        text: code,
        alt: 'Mermaid diagram',
      })
      setImgCopied(true)
      setTimeout(() => setImgCopied(false), 2000)
    } catch (err) {
      console.warn('Copy image failed:', err)
    }
  }, [code, mermaidTheme, svg])

  const exportFile = useCallback(
    async (format: 'svg' | 'png') => {
      if (!svg) return
      try {
        if (format === 'svg') {
          await saveBlobAsFile(new Blob([svg], { type: 'image/svg+xml' }), 'mermaid-diagram.svg', [
            { name: 'SVG Image', extensions: ['svg'] },
          ])
        } else {
          const blob = await svgToPngBlob(
            await renderMermaidSvg(code, 'default'),
            PORTABLE_IMAGE_OPTIONS,
          )
          await saveBlobAsFile(blob, 'mermaid-diagram.png', [
            { name: 'PNG Image', extensions: ['png'] },
          ])
        }
      } catch (err) {
        console.warn('Export failed:', err)
      }
    },
    [code, svg],
  )

  if (isStreaming) {
    return (
      <div className="my-3 overflow-hidden rounded-lg border bg-muted">
        <div className="flex items-center justify-between border-b px-4 py-1.5 text-xs text-muted-foreground">
          <span>mermaid</span>
          <span className="animate-pulse">{t('chat.mermaid.rendering')}</span>
        </div>
        <div className="overflow-x-auto p-4 text-sm">
          <pre>
            <code>{code}</code>
          </pre>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="my-3 overflow-hidden rounded-lg border border-destructive/30 bg-muted">
        <div className="flex items-center gap-2 border-b border-destructive/30 px-4 py-1.5 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>{t('chat.mermaid.error')}</span>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-6 w-6"
            onClick={() => copyCode(code)}>
            {codeCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>
        <div className="p-3 text-xs text-destructive/80">{error}</div>
        <div className="overflow-x-auto border-t p-4 text-sm">
          <pre>
            <code>{code}</code>
          </pre>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="my-3 overflow-hidden rounded-lg border bg-muted">
        <div className="flex items-center justify-between border-b px-4 py-1.5 text-xs text-muted-foreground">
          <span>mermaid</span>
          <div className="flex items-center gap-0.5">
            <BlockToolbarBtn
              icon={codeCopied ? Check : Copy}
              tooltip={t('chat.mermaid.copyCode')}
              onClick={() => copyCode(code)}
            />
            <BlockToolbarBtn
              icon={imgCopied ? Check : Image}
              tooltip={t('chat.mermaid.copyImage')}
              onClick={copyImage}
            />
            <BlockToolbarBtn
              icon={Columns2}
              tooltip={t('chat.mermaid.compare')}
              active={showCompare}
              onClick={() => setShowCompare((v) => !v)}
            />
            <BlockToolbarBtn
              icon={Maximize2}
              tooltip={t('chat.mermaid.fullscreen')}
              onClick={() => setShowFullscreen(true)}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportFile('svg')}>
                  {t('chat.mermaid.exportSvg')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportFile('png')}>
                  {t('chat.mermaid.exportPng')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {showCompare ? (
          <div className="grid min-w-0 grid-cols-2 divide-x">
            <div
              ref={svgContainerRef}
              className="mermaid-svg-container min-w-0 overflow-auto p-4"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
            <div className="min-w-0 overflow-auto p-4 text-sm">
              {highlightedCode ? (
                <div dangerouslySetInnerHTML={{ __html: highlightedCode }} />
              ) : (
                <pre>
                  <code>{code}</code>
                </pre>
              )}
            </div>
          </div>
        ) : (
          <div
            ref={svgContainerRef}
            className="mermaid-svg-container overflow-auto p-4"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        )}
      </div>

      {showFullscreen && (
        <ZoomablePreviewDialog
          zoomInTooltip={t('chat.mermaid.zoomIn')}
          zoomOutTooltip={t('chat.mermaid.zoomOut')}
          zoomResetTooltip={t('chat.mermaid.zoomReset')}
          initialView="fit"
          contentClassName="mermaid-svg-container [&_svg]:!max-w-none [&_svg]:mx-auto"
          onClose={() => setShowFullscreen(false)}>
          <div dangerouslySetInnerHTML={{ __html: svg }} />
        </ZoomablePreviewDialog>
      )}
    </>
  )
})
