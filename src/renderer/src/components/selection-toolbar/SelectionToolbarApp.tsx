import { useEffect, useRef, useState } from 'react'
import type { SelectionToolbarPayload } from '@shared/types'
import { defaultSelectionActionIcon, selectionActionIconMap } from './icons'

export function SelectionToolbarApp(): React.JSX.Element {
  const [payload, setPayload] = useState<SelectionToolbarPayload | null>(null)
  const readySignalled = useRef(false)

  useEffect(() => {
    const unsubscribe = window.api.onSelectionToolbarData((data) => {
      setPayload(data)
    })
    if (!readySignalled.current) {
      readySignalled.current = true
      window.api.selectionToolbarReady()
    }
    return unsubscribe
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        window.api.selectionToolbarClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const actions = payload?.actions ?? []

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="bg-background text-foreground flex h-full w-full items-center gap-0.5 overflow-hidden rounded-xl border px-1.5 shadow-md">
        {actions.length === 0 ? (
          <span className="text-muted-foreground px-2 text-xs">等待选区…</span>
        ) : (
          actions.map((action) => {
            const Icon = selectionActionIconMap[action.icon] ?? defaultSelectionActionIcon
            return (
              <button
                key={action.id}
                title={action.description || action.name}
                aria-label={action.name}
                onMouseDown={(e) => {
                  // mousedown (not click) so we trigger before blur-induced hide
                  e.preventDefault()
                  window.api.selectionToolbarAction(action.id)
                }}
                className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors">
                <Icon className="h-4 w-4" />
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
