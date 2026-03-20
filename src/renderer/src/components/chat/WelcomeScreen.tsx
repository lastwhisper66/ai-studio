import { Lightbulb, Code2, MessageSquare } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import type { Assistant } from '@shared/types'

interface WelcomeScreenProps {
  onSend: (content: string) => void
  assistants?: Assistant[]
  onSelectAssistant?: (id: string) => void
}

const suggestions = [
  {
    icon: Lightbulb,
    label: 'Explain a concept',
    prompt: 'Explain the concept of closures in JavaScript with examples.',
  },
  {
    icon: Code2,
    label: 'Help me write code',
    prompt: 'Help me write a function that finds the most frequent element in an array.',
  },
  {
    icon: MessageSquare,
    label: 'Brainstorm ideas',
    prompt: 'Brainstorm 5 creative project ideas for learning web development.',
  },
]

export function WelcomeScreen({
  onSend,
  assistants,
  onSelectAssistant,
}: WelcomeScreenProps): React.JSX.Element {
  const hasAssistants = assistants && assistants.length > 0

  return (
    <div className="flex h-full items-center justify-center py-20">
      <div className="max-w-lg text-center">
        <h3 className="mb-2 text-2xl font-semibold">Welcome to AI Studio</h3>
        <p className="mb-8 text-muted-foreground">
          Start a conversation or try one of the suggestions below.
        </p>

        {/* Assistant cards */}
        {hasAssistants && onSelectAssistant && (
          <div className="mb-6">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              选择助手开始对话
            </p>
            <div className="grid grid-cols-2 gap-2">
              {assistants.map((a) => (
                <button
                  key={a.id}
                  onClick={() => onSelectAssistant(a.id)}
                  className="flex items-center gap-2.5 rounded-xl border bg-card/50 px-3 py-2.5 text-left transition-colors hover:bg-accent">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{a.name}</div>
                    {a.description && (
                      <div className="truncate text-xs text-muted-foreground">{a.description}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Default suggestions */}
        <div className="flex flex-col gap-3">
          {suggestions.map((s) => (
            <Button
              key={s.label}
              variant="outline"
              className="h-auto justify-start gap-3 rounded-xl px-4 py-3 text-left"
              onClick={() => onSend(s.prompt)}>
              <s.icon className="h-5 w-5 shrink-0 text-muted-foreground" />
              <span>{s.label}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
