import { Lightbulb, Code2, MessageSquare } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'

interface WelcomeScreenProps {
  onSend: (content: string) => void
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

export function WelcomeScreen({ onSend }: WelcomeScreenProps): React.JSX.Element {
  return (
    <div className="flex h-full items-center justify-center py-20">
      <div className="max-w-md text-center">
        <h3 className="mb-2 text-2xl font-semibold">Welcome to AI Studio</h3>
        <p className="mb-8 text-muted-foreground">
          Start a conversation or try one of the suggestions below.
        </p>
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
