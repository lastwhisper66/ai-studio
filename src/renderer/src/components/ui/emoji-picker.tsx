import { lazy, Suspense, useRef, useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { Button } from '@renderer/components/ui/button'
import { SmilePlus, X, Loader2 } from 'lucide-react'

const LazyPicker = lazy(async () => {
  const [{ default: data }, { default: Picker }] = await Promise.all([
    import('@emoji-mart/data'),
    import('@emoji-mart/react'),
  ])
  return {
    default: (props: { onEmojiSelect: (emoji: { native: string }) => void }) => (
      <Picker
        data={data}
        onEmojiSelect={props.onEmojiSelect}
        theme="auto"
        previewPosition="none"
        skinTonePosition="search"
        maxFrequentRows={2}
      />
    ),
  }
})

interface EmojiPickerProps {
  value: string
  onChange: (emoji: string) => void
}

export function EmojiPicker({ value, onChange }: EmojiPickerProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  return (
    <div className="relative inline-flex">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button ref={triggerRef} variant="outline" size="icon" className="h-9 w-9 shrink-0">
            {value ? (
              <span className="text-lg leading-none">{value}</span>
            ) : (
              <SmilePlus className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto border-none p-0 shadow-lg" align="start" sideOffset={8}>
          <Suspense
            fallback={
              <div className="flex h-[350px] w-[352px] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            }>
            <LazyPicker
              onEmojiSelect={(emoji: { native: string }) => {
                onChange(emoji.native)
                setOpen(false)
              }}
            />
          </Suspense>
        </PopoverContent>
      </Popover>
      {value && (
        <button
          type="button"
          className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-muted text-muted-foreground shadow-sm transition-colors hover:bg-destructive hover:text-destructive-foreground"
          onClick={() => onChange('')}>
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  )
}
