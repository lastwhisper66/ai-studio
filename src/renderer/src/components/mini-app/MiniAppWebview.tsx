import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, RotateCw, TriangleAlert } from 'lucide-react'
import type { MiniApp, MiniAppRuntime } from '@shared/types'
import { Button } from '@renderer/components/ui/button'
import { useMiniAppStore } from '@renderer/stores/miniAppStore'
import { MiniAppToolbar } from './MiniAppToolbar'

interface MiniAppWebviewProps {
  app: MiniApp
  /** Hidden tabs stay mounted so their page state survives switching. */
  visible: boolean
}

/**
 * One embedded vendor site.
 *
 * The `<webview>` element is created imperatively rather than through JSX for
 * two reasons: `partition` is immutable once the guest attaches (Electron throws
 * if React later reconciles it), and `allowpopups` is a bare boolean attribute
 * that React's property handling does not set reliably. Building the node once,
 * fully configured, sidesteps both.
 */
export function MiniAppWebview({ app, visible }: MiniAppWebviewProps): React.JSX.Element {
  const { t } = useTranslation()
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<Electron.WebviewTag | null>(null)

  const [runtime, setRuntime] = useState<MiniAppRuntime | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [currentUrl, setCurrentUrl] = useState(app.url)

  const setTabTitle = useMiniAppStore((s) => s.setTabTitle)

  // Partition + masked UA come from the main process; both must be known before
  // the element is created.
  useEffect(() => {
    let cancelled = false
    window.api.getMiniAppRuntime(app.id).then((result) => {
      if (cancelled) return
      if (result.success && result.data) {
        setRuntime(result.data)
      } else {
        console.error('[MiniAppWebview] getMiniAppRuntime failed:', result.error)
        setFailed(true)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
    // app.userAgent is included so an override edit rebuilds the guest.
  }, [app.id, app.userAgent])

  useEffect(() => {
    const host = hostRef.current
    if (!host || !runtime) return

    const view = document.createElement('webview') as Electron.WebviewTag
    view.setAttribute('src', app.url)
    view.setAttribute('partition', runtime.partition)
    view.setAttribute('useragent', runtime.userAgent)
    // Needed for OAuth: the main process re-routes these into an in-app window
    // on the same partition (see main/mini-app-webview.ts).
    view.setAttribute('allowpopups', 'true')
    // Explicit even though these are the defaults — vendor pages must never
    // reach Node or this app's contextBridge surface.
    view.setAttribute('nodeintegration', 'false')
    view.setAttribute('webpreferences', 'contextIsolation=yes,sandbox=yes')
    view.style.width = '100%'
    view.style.height = '100%'
    view.style.border = '0'
    // Chromium sizes an unstyled webview at 300x300 and ignores CSS until the
    // guest attaches; `flex: 1` plus explicit display keeps it filling the host.
    view.style.display = 'inline-flex'
    view.style.flex = '1'

    const syncNav = (): void => {
      setCanGoBack(view.canGoBack())
      setCanGoForward(view.canGoForward())
    }

    const onStartLoading = (): void => {
      setLoading(true)
      setFailed(false)
    }
    const onStopLoading = (): void => {
      setLoading(false)
      syncNav()
    }
    const onFailLoad = (e: Electron.DidFailLoadEvent): void => {
      // -3 is ABORTED, which fires on ordinary in-page navigation cancels and on
      // every redirect chain; treating it as an error would flash a false alarm.
      if (e.errorCode === -3) return
      if (!e.isMainFrame) return
      setFailed(true)
      setLoading(false)
    }
    const onTitle = (e: Electron.PageTitleUpdatedEvent): void => setTabTitle(app.id, e.title)
    const onNavigate = (e: Electron.DidNavigateEvent): void => {
      setCurrentUrl(e.url)
      syncNav()
    }
    const onNavigateInPage = (e: Electron.DidNavigateInPageEvent): void => {
      if (e.isMainFrame) setCurrentUrl(e.url)
      syncNav()
    }

    view.addEventListener('did-start-loading', onStartLoading)
    view.addEventListener('did-stop-loading', onStopLoading)
    view.addEventListener('did-fail-load', onFailLoad)
    view.addEventListener('page-title-updated', onTitle)
    view.addEventListener('did-navigate', onNavigate)
    view.addEventListener('did-navigate-in-page', onNavigateInPage)

    host.appendChild(view)
    viewRef.current = view

    return () => {
      view.removeEventListener('did-start-loading', onStartLoading)
      view.removeEventListener('did-stop-loading', onStopLoading)
      view.removeEventListener('did-fail-load', onFailLoad)
      view.removeEventListener('page-title-updated', onTitle)
      view.removeEventListener('did-navigate', onNavigate)
      view.removeEventListener('did-navigate-in-page', onNavigateInPage)
      view.remove()
      viewRef.current = null
    }
    // `app.url` is deliberately omitted: re-creating the guest on every URL edit
    // would discard the user's live page. Editing the URL re-mounts via the
    // parent's key instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime, app.id, setTabTitle])

  const reload = (): void => {
    setFailed(false)
    viewRef.current?.reload()
  }

  return (
    <div className={visible ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
      <MiniAppToolbar
        app={app}
        currentUrl={currentUrl}
        loading={loading}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onBack={() => viewRef.current?.goBack()}
        onForward={() => viewRef.current?.goForward()}
        onReload={reload}
        onHome={() => viewRef.current?.loadURL(app.url)}
      />

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div ref={hostRef} className="flex min-h-0 flex-1 flex-col bg-white" />

        {loading && !failed && (
          <div className="pointer-events-none absolute top-2 right-3 flex items-center gap-1.5 rounded-md bg-background/90 px-2 py-1 text-xs text-muted-foreground shadow-sm">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t('miniApps.loading')}
          </div>
        )}

        {failed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background">
            <TriangleAlert className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('miniApps.loadFailed')}</p>
            <Button size="sm" variant="outline" onClick={reload}>
              <RotateCw className="mr-1.5 h-3.5 w-3.5" />
              {t('miniApps.retry')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
