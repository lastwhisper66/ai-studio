import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { FileSidebar } from './FileSidebar'
import { EditorToolbar } from './EditorToolbar'
import { CrepeEditor, type CrepeEditorRef } from './CrepeEditor'
import { WelcomeState } from './WelcomeState'
import { useEditorStore } from '@renderer/stores/editorStore'

export function EditorView(): React.JSX.Element {
  const { t } = useTranslation()
  const currentPath = useEditorStore((s) => s.currentPath)
  const isDirty = useEditorStore((s) => s.isDirty)
  const setCurrentPath = useEditorStore((s) => s.setCurrentPath)
  const setDirty = useEditorStore((s) => s.setDirty)

  const [currentContent, setCurrentContent] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')

  const editorRef = useRef<CrepeEditorRef>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flashSaved = useCallback((): void => {
    setSaveStatus('saved')
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000)
  }, [])

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    }
  }, [])

  const handleSave = useCallback(async (): Promise<void> => {
    if (!currentPath) return
    const md = editorRef.current?.getMarkdown() ?? ''
    const r = await window.api.saveEditorFile(currentPath, md)
    if (r.success) {
      setDirty(false)
      flashSaved()
    } else {
      setSaveStatus('error')
    }
  }, [currentPath, setDirty, flashSaved])

  const handleSaveAs = useCallback(async (): Promise<void> => {
    const md = editorRef.current?.getMarkdown() ?? ''
    const r = await window.api.saveEditorFileAs(md, currentPath ?? undefined)
    if (r.success && r.data) {
      setCurrentPath(r.data)
      setDirty(false)
      flashSaved()
    }
  }, [currentPath, setCurrentPath, setDirty, flashSaved])

  const handleFileOpen = useCallback(
    async (path: string, content: string): Promise<void> => {
      if (isDirty && currentPath && window.confirm(t('editor.unsavedConfirm'))) {
        await handleSave()
      }
      setCurrentPath(path)
      setCurrentContent(content)
      setDirty(false)
      setSaveStatus('idle')
    },
    [isDirty, currentPath, t, handleSave, setCurrentPath, setDirty],
  )

  const handleEditorChange = useCallback((): void => {
    setDirty(true)
    setSaveStatus('idle')
  }, [setDirty])

  const reload = useCallback(async (): Promise<void> => {
    if (!currentPath) return
    const r = await window.api.readEditorFile(currentPath)
    if (r.success && r.data !== undefined) {
      setCurrentContent(r.data)
      setDirty(false)
    }
  }, [currentPath, setDirty])

  // Keep a stable reference to the latest save handler for the global key listener.
  const handleSaveRef = useRef(handleSave)
  useEffect(() => {
    handleSaveRef.current = handleSave
  }, [handleSave])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void handleSaveRef.current()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    const unsub = window.api.onEditorFileChanged(({ path, type }) => {
      if (path !== currentPath) return
      if (type === 'removed') {
        window.alert(t('editor.fileGone'))
        return
      }
      if (!isDirty) {
        void reload()
      } else if (
        window.confirm(t('editor.fileChanged.title') + '\n\n' + t('editor.fileChanged.message'))
      ) {
        void reload()
      }
    })
    return unsub
  }, [currentPath, isDirty, reload, t])

  const handleDragOver = useCallback((e: React.DragEvent): void => {
    e.preventDefault()
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent): Promise<void> => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (!file) return
      const filePath = (file as unknown as { path?: string }).path
      if (!filePath) return
      const dir = await window.api.listEditorDir(filePath)
      if (dir.success && dir.data) {
        useEditorStore.getState().setWorkspaceRoot(filePath)
        useEditorStore.getState().setFileTree(dir.data)
        await window.api.addEditorRecent(filePath, 'folder')
      } else {
        const f = await window.api.readEditorFile(filePath)
        if (f.success && f.data !== undefined) {
          await window.api.addEditorRecent(filePath, 'file')
          await handleFileOpen(filePath, f.data)
        }
      }
    },
    [handleFileOpen],
  )

  return (
    <div className="flex h-full" onDragOver={handleDragOver} onDrop={handleDrop}>
      <FileSidebar onFileOpen={handleFileOpen} />
      <div className="flex min-w-0 flex-1 flex-col">
        <EditorToolbar onSave={handleSave} onSaveAs={handleSaveAs} saveStatus={saveStatus} />
        <div className="flex-1 overflow-hidden">
          {currentPath ? (
            <CrepeEditor
              key={currentPath}
              ref={editorRef}
              defaultValue={currentContent}
              onChange={handleEditorChange}
            />
          ) : (
            <WelcomeState />
          )}
        </div>
      </div>
    </div>
  )
}
