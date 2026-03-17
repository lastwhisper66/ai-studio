import { useState } from 'react'
import { Send, Square } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Textarea } from '@renderer/components/ui/textarea'
import { InputToolbar } from './InputToolbar'

interface MessageInputProps {
  onSend: (content: string) => void
  onStop: () => void
  isStreaming: boolean
}

export function MessageInput({
  onSend,
  onStop,
  isStreaming,
}: MessageInputProps): React.JSX.Element {
  const [input, setInput] = useState('')

  const handleSend = (): void => {
    const content = input.trim()
    if (!content || isStreaming) return
    setInput('')
    onSend(content)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="px-4 pb-4 pt-2">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border bg-card shadow-sm">
          {/* Textarea area */}
          <div className="px-4 pt-3 pb-2">
            <Textarea
              placeholder={isStreaming ? 'AI 正在生成中...' : '在这里输入消息，按 Enter 发送'}
              className="min-h-[60px] resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
            />
          </div>

          {/* Bottom bar: toolbar + send button */}
          <div className="flex items-center justify-between px-3 pb-2">
            <InputToolbar />
            <div className="flex items-center gap-1">
              {isStreaming ? (
                <Button
                  size="icon"
                  variant="destructive"
                  className="h-8 w-8 rounded-lg"
                  onClick={onStop}>
                  <Square className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  onClick={handleSend}
                  disabled={!input.trim()}>
                  <Send className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
