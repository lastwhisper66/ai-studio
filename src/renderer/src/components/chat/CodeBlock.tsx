import { useState, useEffect, useCallback, useRef, memo } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { useTheme } from '@renderer/hooks/useTheme'
import { highlightCode } from '@renderer/lib/shiki'

interface CodeBlockProps {
  code: string
  language: string
}

export const CodeBlock = memo(function CodeBlock({ code, language }: CodeBlockProps) {
  const { theme } = useTheme()
  const [highlightedHtml, setHighlightedHtml] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const shikiTheme = theme === 'light' ? 'github-light' : 'github-dark'

  useEffect(() => {
    let cancelled = false
    highlightCode(code, language, shikiTheme).then((html) => {
      if (!cancelled) setHighlightedHtml(html)
    })
    return () => {
      cancelled = true
    }
  }, [code, language, shikiTheme])

  useEffect(() => {
    return () => clearTimeout(copyTimerRef.current)
  }, [])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).catch(() => {})
    setCopied(true)
    clearTimeout(copyTimerRef.current)
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000)
  }, [code])

  return (
    <div className="my-3 overflow-hidden rounded-lg border bg-muted/50">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b px-4 py-1.5 text-xs text-muted-foreground">
        <span>{language || 'text'}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleCopy}
          aria-label="Copy code">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {/* Code content */}
      <div className="overflow-x-auto p-4 text-sm">
        {highlightedHtml ? (
          <div className="shiki" dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
        ) : (
          <pre>
            <code>{code}</code>
          </pre>
        )}
      </div>
    </div>
  )
})
