import { useState, useRef, useEffect, memo } from 'react'
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import { useTheme } from '@renderer/hooks/useTheme'
import { highlightCode } from '@renderer/lib/shiki'
import { useCopyToClipboard } from '@renderer/hooks/useCopyToClipboard'

const COLLAPSE_THRESHOLD = 20

interface CodeBlockProps {
  code: string
  language: string
}

export const CodeBlock = memo(function CodeBlock({ code, language }: CodeBlockProps) {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const [highlightedHtml, setHighlightedHtml] = useState<string>('')
  const { copied, copy } = useCopyToClipboard()

  const lineCount = code.split('\n').length
  const collapsible = lineCount > COLLAPSE_THRESHOLD
  const userToggled = useRef(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (!userToggled.current) setCollapsed(collapsible)
  }, [collapsible])

  const shikiTheme = resolvedTheme === 'light' ? 'github-light' : 'github-dark'

  useEffect(() => {
    let cancelled = false
    highlightCode(code, language, shikiTheme)
      .then((html) => {
        if (!cancelled) setHighlightedHtml(html)
      })
      .catch((err) => {
        console.error('[CodeBlock] shiki highlight failed:', err)
      })
    return () => {
      cancelled = true
    }
  }, [code, language, shikiTheme])

  return (
    <div className="my-3 overflow-hidden rounded-lg border bg-muted">
      <div className="flex items-center justify-between border-b px-4 py-1.5 text-xs text-muted-foreground">
        <span>
          {language || 'text'}
          {collapsible && (
            <span className="ml-2 text-muted-foreground/60">({lineCount} lines)</span>
          )}
        </span>
        <div className="flex items-center gap-0.5">
          {collapsible && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => {
                userToggled.current = true
                setCollapsed((v) => !v)
              }}
              aria-label={collapsed ? 'Expand code' : 'Collapse code'}>
              {collapsed ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronUp className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => copy(code)}
            aria-label="Copy code">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      <div
        className={`overflow-x-auto p-4 text-sm ${collapsed ? 'max-h-[200px] overflow-y-hidden' : ''}`}>
        {highlightedHtml ? (
          <div dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
        ) : (
          <pre>
            <code>{code}</code>
          </pre>
        )}
      </div>

      {collapsed && (
        <div
          className="relative -mt-8 flex cursor-pointer items-end justify-center bg-gradient-to-t from-muted to-transparent pb-2 pt-8"
          onClick={() => {
            userToggled.current = true
            setCollapsed(false)
          }}>
          <span className="text-xs text-muted-foreground hover:text-foreground">
            {t('chat.code.expand')}
          </span>
        </div>
      )}
    </div>
  )
})
