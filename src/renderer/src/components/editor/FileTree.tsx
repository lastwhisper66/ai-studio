import { useState } from 'react'
import { ChevronRight, ChevronDown, File, Folder } from 'lucide-react'
import type { TreeEntry } from '@shared/types'
import { cn } from '@renderer/lib/utils'

interface FileTreeProps {
  entries: TreeEntry[]
  onSelect: (path: string) => void
  currentPath: string | null
}

function TreeNode({
  entry,
  onSelect,
  currentPath,
}: {
  entry: TreeEntry
  onSelect: (path: string) => void
  currentPath: string | null
}): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false)
  const [children, setChildren] = useState<TreeEntry[]>(entry.children ?? [])
  const [isLoading, setIsLoading] = useState(false)

  const handleClick = async (): Promise<void> => {
    if (!entry.isDirectory) {
      onSelect(entry.path)
      return
    }
    if (!isExpanded && children.length === 0) {
      setIsLoading(true)
      const result = await window.api.listEditorDir(entry.path)
      if (result.success && result.data) setChildren(result.data)
      setIsLoading(false)
    }
    setIsExpanded(!isExpanded)
  }

  return (
    <div>
      <div
        className={cn(
          'flex cursor-pointer items-center gap-1 rounded px-2 py-1 hover:bg-accent',
          currentPath === entry.path && 'bg-accent',
        )}
        onClick={handleClick}>
        {entry.isDirectory ? (
          isExpanded ? (
            <ChevronDown size={16} />
          ) : (
            <ChevronRight size={16} />
          )
        ) : (
          <span className="w-4" />
        )}
        {entry.isDirectory ? <Folder size={16} /> : <File size={16} />}
        <span className="truncate text-sm">{entry.name}</span>
        {isLoading && <span className="ml-auto text-xs text-muted-foreground">...</span>}
      </div>
      {isExpanded && children.length > 0 && (
        <div className="ml-4">
          {children.map((child) => (
            <TreeNode
              key={child.path}
              entry={child}
              onSelect={onSelect}
              currentPath={currentPath}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function FileTree({ entries, onSelect, currentPath }: FileTreeProps): React.JSX.Element {
  return (
    <div className="space-y-1 p-2">
      {entries.map((entry) => (
        <TreeNode key={entry.path} entry={entry} onSelect={onSelect} currentPath={currentPath} />
      ))}
    </div>
  )
}
