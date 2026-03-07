import { useState, useCallback } from 'react'
import { Sidebar } from './Sidebar'
import { ChatPanel } from './ChatPanel'

const STORAGE_KEY = 'ai-studio-sidebar-collapsed'

export function AppLayout(): React.JSX.Element {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  })

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, String(next))
      return next
    })
  }, [])

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      <ChatPanel sidebarCollapsed={sidebarCollapsed} onToggleSidebar={toggleSidebar} />
    </div>
  )
}
