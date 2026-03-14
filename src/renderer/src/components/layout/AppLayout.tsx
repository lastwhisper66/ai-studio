import { lazy, Suspense, useState, useCallback, useEffect } from 'react'
import { PrimaryNav } from './PrimaryNav'
import { ConversationPanel } from './ConversationPanel'
import { ChatPanel } from './ChatPanel'
import { useSettingsStore } from '@renderer/stores/settingsStore'

const SettingsPage = lazy(() =>
  import('@renderer/components/settings').then((m) => ({ default: m.SettingsPage })),
)

const STORAGE_KEY = 'ai-studio-sidebar-collapsed'

export function AppLayout(): React.JSX.Element {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  })

  const activeView = useSettingsStore((s) => s.activeView)

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
    <div className="flex h-screen w-screen overflow-hidden">
      <PrimaryNav />
      {activeView === 'chat' ? (
        <>
          <ConversationPanel collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
          <ChatPanel sidebarCollapsed={sidebarCollapsed} onToggleSidebar={toggleSidebar} />
        </>
      ) : (
        <Suspense fallback={null}>
          <SettingsPage />
        </Suspense>
      )}
    </div>
  )
}
