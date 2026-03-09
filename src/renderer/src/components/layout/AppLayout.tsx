import { lazy, Suspense, useState, useCallback, useEffect } from 'react'
import { PrimaryNav } from './PrimaryNav'
import { ConversationPanel } from './ConversationPanel'
import { ChatPanel } from './ChatPanel'
import { useSettingsStore } from '@renderer/stores/settingsStore'

const SettingsDialog = lazy(() =>
  import('@renderer/components/settings').then((m) => ({ default: m.SettingsDialog })),
)

const STORAGE_KEY = 'ai-studio-sidebar-collapsed'

export function AppLayout(): React.JSX.Element {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  })

  const dialogOpen = useSettingsStore((s) => s.dialogOpen)
  const setDialogOpen = useSettingsStore((s) => s.setDialogOpen)

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, String(next))
      return next
    })
  }, [])

  // Ctrl+B to toggle conversation panel
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault()
        toggleSidebar()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [toggleSidebar])

  return (
    <>
      <div className="flex h-screen w-screen overflow-hidden">
        <PrimaryNav />
        <ConversationPanel collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
        <ChatPanel sidebarCollapsed={sidebarCollapsed} onToggleSidebar={toggleSidebar} />
      </div>

      <Suspense fallback={null}>
        {dialogOpen && <SettingsDialog open={dialogOpen} onOpenChange={setDialogOpen} />}
      </Suspense>
    </>
  )
}
