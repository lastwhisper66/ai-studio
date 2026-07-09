import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { Crepe } from '@milkdown/crepe'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'

export interface CrepeEditorRef {
  getMarkdown: () => string
}

interface CrepeEditorProps {
  defaultValue: string
  onChange: (markdown: string) => void
}

export const CrepeEditor = forwardRef<CrepeEditorRef, CrepeEditorProps>(function CrepeEditor(
  { defaultValue, onChange },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const crepeRef = useRef<Crepe | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useImperativeHandle(ref, () => ({
    getMarkdown: () => crepeRef.current?.getMarkdown() ?? '',
  }))

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let destroyed = false
    let ready = false
    const crepe = new Crepe({ root: container, defaultValue })
    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown) => {
        if (ready) onChangeRef.current(markdown)
      })
    })
    crepeRef.current = crepe
    crepe
      .create()
      .then(() => {
        if (destroyed) {
          crepe.destroy()
          return
        }
        // Ignore the update events fired during initial rendering so the file
        // isn't marked dirty on load.
        setTimeout(() => {
          ready = true
        }, 0)
      })
      .catch(() => {})

    return () => {
      destroyed = true
      crepeRef.current = null
      crepe.destroy()
    }
  }, [defaultValue])

  return <div ref={containerRef} className="crepe-editor h-full w-full overflow-auto" />
})
