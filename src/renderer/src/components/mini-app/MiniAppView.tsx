import { useEffect } from 'react'
import { useMiniAppStore } from '@renderer/stores/miniAppStore'
import { MiniAppTabBar } from './MiniAppTabBar'
import { MiniAppGrid } from './MiniAppGrid'
import { MiniAppWebview } from './MiniAppWebview'

/**
 * The Mini Apps page.
 *
 * Every open tab stays mounted; only its visibility flips. Unmounting a
 * `<webview>` destroys the guest, which would drop the page's scroll position
 * and any half-typed prompt — so hidden tabs are hidden with CSS, never
 * conditionally rendered. The same contract applies one level up: `AppLayout`
 * keeps this component mounted while the user is on another view.
 */
export function MiniAppView(): React.JSX.Element {
  const apps = useMiniAppStore((s) => s.apps)
  const isLoaded = useMiniAppStore((s) => s.isLoaded)
  const loadApps = useMiniAppStore((s) => s.loadApps)
  const tabs = useMiniAppStore((s) => s.tabs)
  const activeTabId = useMiniAppStore((s) => s.activeTabId)
  const openTab = useMiniAppStore((s) => s.openTab)
  const closeTab = useMiniAppStore((s) => s.closeTab)
  const setActiveTab = useMiniAppStore((s) => s.setActiveTab)

  // Self-loading: this view can be reached before App.tsx's initial load
  // settles, and a settings-page edit may have happened since.
  useEffect(() => {
    if (!isLoaded) loadApps()
  }, [isLoaded, loadApps])

  const appById = new Map(apps.map((a) => [a.id, a]))

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      {tabs.length > 0 && (
        <MiniAppTabBar
          tabs={tabs}
          apps={apps}
          activeTabId={activeTabId}
          onSelect={setActiveTab}
          onClose={closeTab}
          onShowGrid={() => setActiveTab(null)}
        />
      )}

      <div className="relative flex min-h-0 flex-1 flex-col">
        {/* The grid is also kept mounted so its search box survives a round-trip
            through a tab. */}
        <div className={activeTabId ? 'hidden' : 'flex min-h-0 flex-1 flex-col'}>
          <MiniAppGrid apps={apps} onOpen={openTab} />
        </div>

        {tabs.map((tab) => {
          const app = appById.get(tab.appId)
          if (!app) return null
          return (
            <MiniAppWebview
              // Keyed on the fields baked into the guest at creation time, so an
              // edit to either rebuilds it instead of silently diverging.
              key={`${app.id}:${app.url}:${app.userAgent}`}
              app={app}
              visible={tab.appId === activeTabId}
            />
          )
        })}
      </div>
    </div>
  )
}
