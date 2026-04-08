import { lazy, Suspense, useState, useCallback, useEffect } from 'react'
import { matchesShortcut } from '@shared/keybindings'
import { PrimaryNav } from './PrimaryNav'
import { AssistantSidebar } from './AssistantSidebar'
import { ChatPanel } from './ChatPanel'
import { TopicPanel } from './TopicPanel'
import { TitleBar } from './TitleBar'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { useKeybindingStore } from '@renderer/stores/keybindingStore'
import { useSidebarResize } from '@renderer/hooks/useSidebarResize'

const SettingsPage = lazy(() =>
  import('@renderer/components/settings').then((m) => ({ default: m.SettingsPage })),
)

const TranslateView = lazy(() =>
  import('@renderer/components/translate/TranslateView').then((m) => ({
    default: m.TranslateView,
  })),
)

const SIDEBAR_STORAGE_KEY = 'ai-studio-sidebar-collapsed'
const TOPIC_STORAGE_KEY = 'ai-studio-topic-collapsed'
const SIDEBAR_WIDTH_KEY = 'ai-studio-sidebar-width'
const TOPIC_WIDTH_KEY = 'ai-studio-topic-width'

export function AppLayout(): React.JSX.Element {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'
  })

  const [topicCollapsed, setTopicCollapsed] = useState(() => {
    return localStorage.getItem(TOPIC_STORAGE_KEY) === 'true'
  })

  const activeView = useSettingsStore((s) => s.activeView)

  const {
    width: sidebarWidth,
    isResizing: sidebarResizing,
    handleMouseDown: sidebarDragStart,
  } = useSidebarResize(SIDEBAR_WIDTH_KEY, 'left')
  const {
    width: topicWidth,
    isResizing: topicResizing,
    handleMouseDown: topicDragStart,
  } = useSidebarResize(TOPIC_WIDTH_KEY, 'right')

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next))
      return next
    })
  }, [])

  const toggleTopic = useCallback(() => {
    setTopicCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(TOPIC_STORAGE_KEY, String(next))
      return next
    })
  }, [])

  const getAccelerator = useKeybindingStore((s) => s.getAccelerator)

  // Configurable sidebar toggle shortcut — only active on chat view
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (useSettingsStore.getState().activeView !== 'chat') return
      const accel = getAccelerator('toggle-sidebar')
      if (matchesShortcut(e, accel)) {
        e.preventDefault()
        toggleSidebar()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [toggleSidebar, getAccelerator])

  return (
    <div
      className={`flex h-screen w-screen flex-col overflow-hidden${sidebarResizing || topicResizing ? ' cursor-col-resize select-none' : ''}`}>
      <TitleBar sidebarCollapsed={sidebarCollapsed} onToggleSidebar={toggleSidebar} />
      <div className="flex flex-1 overflow-hidden">
        <PrimaryNav />
        {activeView === 'chat' ? (
          <>
            <AssistantSidebar
              collapsed={sidebarCollapsed}
              width={sidebarWidth}
              isResizing={sidebarResizing}
              onResizeStart={sidebarDragStart}
            />
            <ChatPanel topicCollapsed={topicCollapsed} onToggleTopic={toggleTopic} />
            <TopicPanel
              collapsed={topicCollapsed}
              width={topicWidth}
              isResizing={topicResizing}
              onResizeStart={topicDragStart}
            />
          </>
        ) : activeView === 'translate' ? (
          <Suspense fallback={null}>
            <TranslateView />
          </Suspense>
        ) : (
          <Suspense fallback={null}>
            <SettingsPage />
          </Suspense>
        )}
      </div>
    </div>
  )
}
