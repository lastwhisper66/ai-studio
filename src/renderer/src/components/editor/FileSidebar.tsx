import { useState, useEffect, useCallback } from 'react'
import { FolderOpen, FileText, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import { FileTree } from './FileTree'
import { useEditorStore } from '@renderer/stores/editorStore'
import { cn } from '@renderer/lib/utils'
import type { RecentEntry } from '@shared/types'

interface FileSidebarProps {
  onFileOpen: (path: string, content: string) => void
}

export function FileSidebar({ onFileOpen }: FileSidebarProps): React.JSX.Element {
  const { t } = useTranslation()
  const workspaceRoot = useEditorStore((s) => s.workspaceRoot)
  const fileTree = useEditorStore((s) => s.fileTree)
  const currentPath = useEditorStore((s) => s.currentPath)
  const recent = useEditorStore((s) => s.recent)
  const setWorkspaceRoot = useEditorStore((s) => s.setWorkspaceRoot)
  const setFileTree = useEditorStore((s) => s.setFileTree)
  const setRecent = useEditorStore((s) => s.setRecent)

  const [activeTab, setActiveTab] = useState<'tree' | 'recent'>('tree')

  const loadRecent = useCallback(async (): Promise<void> => {
    const result = await window.api.listEditorRecent()
    if (result.success && result.data) {
      setRecent(result.data)
    }
  }, [setRecent])

  useEffect(() => {
    loadRecent()
  }, [loadRecent])

  const handleOpenFile = async (): Promise<void> => {
    const result = await window.api.openEditorFileDialog()
    if (result.success && result.data) {
      const { path, content } = result.data
      await window.api.addEditorRecent(path, 'file')
      await loadRecent()
      onFileOpen(path, content)
    }
  }

  const handleOpenFolder = async (): Promise<void> => {
    const result = await window.api.openEditorFolderDialog()
    if (result.success && result.data) {
      const { root, tree } = result.data
      setWorkspaceRoot(root)
      setFileTree(tree)
      await window.api.addEditorRecent(root, 'folder')
      await loadRecent()
      setActiveTab('tree')
    }
  }

  const handleTreeSelect = async (path: string): Promise<void> => {
    const result = await window.api.readEditorFile(path)
    if (result.success && result.data !== undefined) {
      await window.api.addEditorRecent(path, 'file')
      await loadRecent()
      onFileOpen(path, result.data)
    }
  }

  const handleRecentClick = async (entry: RecentEntry): Promise<void> => {
    if (entry.kind === 'file') {
      const result = await window.api.readEditorFile(entry.path)
      if (result.success && result.data !== undefined) {
        await window.api.addEditorRecent(entry.path, 'file')
        await loadRecent()
        onFileOpen(entry.path, result.data)
      }
    } else {
      const result = await window.api.listEditorDir(entry.path)
      if (result.success && result.data) {
        setWorkspaceRoot(entry.path)
        setFileTree(result.data)
        await window.api.addEditorRecent(entry.path, 'folder')
        await loadRecent()
        setActiveTab('tree')
      }
    }
  }

  return (
    <div className="flex h-full w-64 flex-col border-r bg-background">
      <div className="flex gap-2 border-b p-2">
        <Button onClick={handleOpenFile} variant="outline" size="sm" className="flex-1">
          <FileText size={16} className="mr-1" />
          {t('editor.openFile')}
        </Button>
        <Button onClick={handleOpenFolder} variant="outline" size="sm" className="flex-1">
          <FolderOpen size={16} className="mr-1" />
          {t('editor.openFolder')}
        </Button>
      </div>

      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('tree')}
          className={cn(
            'flex-1 px-4 py-2 text-sm',
            activeTab === 'tree'
              ? 'border-b-2 border-primary font-medium'
              : 'text-muted-foreground',
          )}>
          <FolderOpen size={16} className="mr-1 inline" />
          {t('editor.fileTree')}
        </button>
        <button
          onClick={() => setActiveTab('recent')}
          className={cn(
            'flex-1 px-4 py-2 text-sm',
            activeTab === 'recent'
              ? 'border-b-2 border-primary font-medium'
              : 'text-muted-foreground',
          )}>
          <Clock size={16} className="mr-1 inline" />
          {t('editor.recent')}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'tree' ? (
          workspaceRoot ? (
            <FileTree entries={fileTree} onSelect={handleTreeSelect} currentPath={currentPath} />
          ) : (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {t('editor.noWorkspace')}
            </div>
          )
        ) : (
          <div className="space-y-1 p-2">
            {recent.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {t('editor.noRecent')}
              </div>
            ) : (
              recent.map((entry) => (
                <div
                  key={entry.path}
                  onClick={() => handleRecentClick(entry)}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent">
                  {entry.kind === 'folder' ? <FolderOpen size={16} /> : <FileText size={16} />}
                  <span className="flex-1 truncate">{entry.path.split(/[\\/]/).pop()}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
