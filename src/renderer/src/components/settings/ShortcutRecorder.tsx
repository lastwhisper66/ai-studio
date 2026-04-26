import { useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { acceleratorFromEvent, formatKeyLabel } from '@shared/keybindings'
import { cn } from '@renderer/lib/utils'

interface ShortcutRecorderProps {
  value: string
  onChange: (accelerator: string) => void
  disabled?: boolean
}

function ShortcutDisplay({ accelerator }: { accelerator: string }): React.JSX.Element {
  const parts = accelerator.split('+')
  return (
    <span className="inline-flex items-center gap-0.5">
      {parts.map((part, i) => (
        <kbd
          key={i}
          className="bg-background border-border inline-flex min-w-[24px] items-center justify-center rounded border px-1.5 py-0.5 font-mono text-xs shadow-sm">
          {formatKeyLabel(part)}
        </kbd>
      ))}
    </span>
  )
}

export { ShortcutDisplay }

export function ShortcutRecorder({
  value,
  onChange,
  disabled,
}: ShortcutRecorderProps): React.JSX.Element {
  const { t } = useTranslation()
  const [isRecording, setIsRecording] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const startRecording = useCallback(() => {
    setIsRecording(true)
    containerRef.current?.focus()
  }, [])

  const stopRecording = useCallback(() => {
    setIsRecording(false)
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      // Escape while recording → cancel
      if (e.key === 'Escape' && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
        stopRecording()
        return
      }

      const accelerator = acceleratorFromEvent(e.nativeEvent)
      if (!accelerator) return

      onChange(accelerator)
      stopRecording()
    },
    [onChange, stopRecording],
  )

  const handleClick = useCallback(() => {
    if (disabled) return
    startRecording()
  }, [disabled, startRecording])

  const handleBlur = useCallback(() => {
    stopRecording()
  }, [stopRecording])

  const handleContainerKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isRecording) {
        handleKeyDown(e)
      } else if (e.key === 'Enter' || e.key === ' ') {
        // Keyboard activation for role="button"
        e.preventDefault()
        if (!disabled) {
          startRecording()
        }
      }
    },
    [isRecording, handleKeyDown, disabled, startRecording],
  )

  return (
    <div
      ref={containerRef}
      tabIndex={disabled ? -1 : 0}
      role="button"
      className={cn(
        'inline-flex h-9 min-w-30 cursor-pointer select-none items-center justify-center gap-1 rounded-md border px-3 py-1.5 text-sm',
        isRecording
          ? 'border-primary bg-primary/10 ring-primary/30 ring-2'
          : 'border-border bg-muted hover:bg-accent',
        disabled && 'cursor-default opacity-60',
      )}
      onClick={handleClick}
      onKeyDown={handleContainerKeyDown}
      onBlur={handleBlur}>
      {isRecording ? (
        <span className="text-primary animate-pulse text-xs">{t('keybindings.pressShortcut')}</span>
      ) : (
        <ShortcutDisplay accelerator={value} />
      )}
    </div>
  )
}
