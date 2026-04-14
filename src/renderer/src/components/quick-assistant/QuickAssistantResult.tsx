import { useRef, useEffect } from 'react'
import { MarkdownRenderer } from '@renderer/components/chat/MarkdownRenderer'
import { ScrollArea } from '@renderer/components/ui/scroll-area'

interface QuickAssistantResultProps {
  content: string
  isStreaming: boolean
  error: string | null
}

export function QuickAssistantResult({
  content,
  isStreaming,
  error,
}: QuickAssistantResultProps): React.JSX.Element {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [content])

  return (
    <div className="flex h-full flex-col">
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
