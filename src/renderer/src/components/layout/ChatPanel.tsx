import { Send } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Textarea } from '@renderer/components/ui/textarea'
import { ScrollArea } from '@renderer/components/ui/scroll-area'

export function ChatPanel(): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center border-b px-6 py-3">
        <h2 className="text-sm font-medium">New Chat</h2>
      </div>

      {/* Messages area */}
      <ScrollArea className="flex-1">
        <div className="flex h-full items-center justify-center p-8">
          <div className="max-w-md text-center">
            <h3 className="mb-2 text-2xl font-semibold">Welcome to AI Studio</h3>
            <p className="text-muted-foreground">Start a conversation by typing a message below.</p>
          </div>
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="border-t p-4">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <Textarea
            placeholder="Type a message..."
            className="min-h-11 flex-1 resize-none"
            rows={1}
          />
          <Button size="icon" className="h-11 w-11 shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
