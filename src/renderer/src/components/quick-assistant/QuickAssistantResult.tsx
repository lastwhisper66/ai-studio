import { useRef, useEffect, useState } from 'react'
import { Square, ArrowLeft, Copy, Check } from 'lucide-react'
import { MarkdownRenderer } from '@renderer/components/chat/MarkdownRenderer'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'
import { LANGUAGES } from '@renderer/lib/languages'

interface QuickAssistantResultProps {
  content: string
  isStreaming: boolean
  error: string | null
  onStop: () => void
  onBack: () => void
  isTranslateAction?: boolean
  targetLang?: string
  onTargetLangChange?: (lang: string) => void
}

export function QuickAssistantResult({
  content,
  isStreaming,
  error,
  onStop,
  onBack,
  isTranslateAction,
  targetLang,
  onTargetLangChange,
}: QuickAssistantResultProps): React.JSX.Element {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [content])

  const handleCopy = (): void => {
    if (!content) return
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <button
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          返回
        </button>
        <div className="flex items-center gap-1">
          {isTranslateAction && targetLang && onTargetLangChange && (
            <Select value={targetLang} onValueChange={onTargetLangChange}>
              <SelectTrigger className="h-7 w-28 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom">
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {isStreaming && (
            <button
              onClick={onStop}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors">
              <Square className="h-3 w-3" />
              停止
            </button>
          )}
          {content && !isStreaming && (
            <button
              onClick={handleCopy}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? '已复制' : '复制'}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {error ? (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          ) : content ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <MarkdownRenderer content={content} />
            </div>
          ) : isStreaming ? (
            <div className="flex items-center gap-2 py-4">
              <div className="bg-primary/60 h-2 w-2 animate-pulse rounded-full" />
              <span className="text-muted-foreground text-sm">正在生成...</span>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  )
}
