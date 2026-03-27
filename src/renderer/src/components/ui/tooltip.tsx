import * as React from 'react'
import { Tooltip as TooltipPrimitive } from 'radix-ui'

import { cn } from '@renderer/lib/utils'

// Context to communicate pointer state from TooltipTrigger to Tooltip
const TooltipPointerContext = React.createContext<{
  setPointerIn: (v: boolean) => void
}>({ setPointerIn: () => {} })

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      disableHoverableContent
      {...props}
    />
  )
}

function Tooltip({
  open: openProp,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  const [pointerIn, setPointerIn] = React.useState(false)
  const [internalOpen, setInternalOpen] = React.useState(false)

  // If open prop is explicitly provided (not undefined), respect it.
  // Otherwise, only show when pointer is hovering (ignore focus events).
  const isControlled = openProp !== undefined
  const computedOpen = isControlled ? openProp : pointerIn && internalOpen

  return (
    <TooltipPointerContext.Provider value={{ setPointerIn }}>
      <TooltipPrimitive.Root
        data-slot="tooltip"
        open={computedOpen}
        onOpenChange={setInternalOpen}
        {...props}>
        {children}
      </TooltipPrimitive.Root>
    </TooltipPointerContext.Provider>
  )
}

function TooltipTrigger({
  onPointerEnter,
  onPointerLeave,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  const { setPointerIn } = React.useContext(TooltipPointerContext)
  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      onPointerEnter={(e) => {
        setPointerIn(true)
        onPointerEnter?.(e)
      }}
      onPointerLeave={(e) => {
        setPointerIn(false)
        onPointerLeave?.(e)
      }}
      {...props}
    />
  )
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          'z-50 w-fit origin-(--radix-tooltip-content-transform-origin) animate-in rounded-md bg-foreground px-3 py-1.5 text-xs text-balance text-background fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          className,
        )}
        {...props}>
        {children}
        <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
