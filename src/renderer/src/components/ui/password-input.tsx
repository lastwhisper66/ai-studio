import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from './input'
import { Button } from './button'
import { cn } from '@renderer/lib/utils'

/**
 * Password input with a built-in visibility toggle (eye / eye-off).
 *
 * Mirrors the `<Input>` API — accepts every native `<input>` prop except
 * `type` (which is owned by this component). The visibility state lives
 * locally so callers don't have to manage it themselves; pass `defaultVisible`
 * if you need a different initial state.
 *
 * The reveal button is rendered ABSOLUTELY inside the same wrapper, so
 * `className` on this component still applies to the visible input box.
 * The right-padding (`pr-10`) is added automatically so input text never
 * runs under the eye button.
 *
 * Inspired by the inline pattern used in `ProviderDetail.tsx` for the API
 * key input — kept as a separate `<Input>` reuse so we don't break existing
 * Input styling.
 */
type PasswordInputProps = Omit<React.ComponentProps<'input'>, 'type'> & {
  defaultVisible?: boolean
}

function PasswordInput({
  className,
  defaultVisible = false,
  ...props
}: PasswordInputProps): React.JSX.Element {
  const [visible, setVisible] = React.useState(defaultVisible)
  return (
    <div className="relative w-full">
      <Input {...props} type={visible ? 'text' : 'password'} className={cn('pr-10', className)} />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        tabIndex={-1}
        className="absolute top-0 right-0 h-full w-10 hover:bg-transparent"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}>
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
    </div>
  )
}

export { PasswordInput }
