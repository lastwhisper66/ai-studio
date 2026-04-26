import { lazy, Suspense, useState, useCallback, useEffect } from 'react'
import { matchesShortcut } from '@shared/keybindings'
import { PrimaryNav } from './PrimaryNav'
import { AssistantSidebar } from './AssistantSidebar'
import { ChatPanel } from './ChatPanel'
import { TopicPanel } from './TopicPanel'
import { TitleBar } from './TitleBar'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { useKeybindingStore } from '@renderer/stores/keybindingStore'

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

export function AppLayout(): React.JSX.Element {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'
  })

  const [topicCollapsed, setTopicCollapsed] = useState(() => {
    return localStorage.getItem(TOPIC_STORAGE_KEY) === 'true'
  })

  const activeView = useSettingsStore((s) => s.activeView)

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

  const getEffectiveAccelerator = useKeybindingStore((s) => s.getEffectiveAccelerator)

  // Configurable sidebar toggle shortcut — only active on chat view
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (useSettingsStore.getState().activeView !== 'chat') return
      const accel = getEffectiveAccelerator('toggle-sidebar')
      if (matchesShortcut(e, accel)) {
        e.preventDefault()
        toggleSidebar()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [toggleSidebar, getEffectiveAccelerator])

  // Configurable topic panel toggle shortcut — only active on chat view
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (useSettingsStore.getState().activeView !== 'chat') return
      const accel = getEffectiveAccelerator('toggle-topic')
      if (matchesShortcut(e, accel)) {
        e.preventDefault()
        toggleTopic()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [toggleTopic, getEffectiveAccelerator])

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <TitleBar sidebarCollapsed={sidebarCollapsed} onToggleSidebar={toggleSidebar} />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <PrimaryNav />
        {activeView === 'chat' ? (
          <>
            <AssistantSidebar collapsed={sidebarCollapsed} />
            <ChatPanel topicCollapsed={topicCollapsed} onToggleTopic={toggleTopic} />
            <TopicPanel collapsed={topicCollapsed} />
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
