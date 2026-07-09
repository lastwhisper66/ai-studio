import { create } from 'zustand'
import type { TreeEntry, RecentEntry } from '@shared/types'

interface EditorState {
  currentPath: string | null
  workspaceRoot: string | null
  fileTree: TreeEntry[]
  isDirty: boolean
  recent: RecentEntry[]

  setCurrentPath: (path: string | null) => void
  setWorkspaceRoot: (root: string | null) => void
  setFileTree: (tree: TreeEntry[]) => void
  setDirty: (dirty: boolean) => void
  setRecent: (recent: RecentEntry[]) => void
  reset: () => void
}

const initialState = {
  currentPath: null,
  workspaceRoot: null,
  fileTree: [],
  isDirty: false,
  recent: [],
}

export const useEditorStore = create<EditorState>((set) => ({
  ...initialState,
  setCurrentPath: (path) => set({ currentPath: path }),
  setWorkspaceRoot: (root) => set({ workspaceRoot: root }),
  setFileTree: (tree) => set({ fileTree: tree }),
  setDirty: (dirty) => set({ isDirty: dirty }),
  setRecent: (recent) => set({ recent }),
  reset: () => set(initialState),
}))
