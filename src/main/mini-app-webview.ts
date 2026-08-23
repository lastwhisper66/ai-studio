import { app, shell, session, type Session, type WebContents } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import { listMiniApps } from './db'
import { getMainWindow } from './app-state'
import { getMiniAppPartition, resolveMiniAppUserAgent } from './mini-app-session'

/**
 * Guest-contents hardening and popup routing for Mini App <webview>s.
 *
 * The main window routes every `window.open` to the system browser
 * (see `setWindowOpenHandler` in ./index.ts). Mini apps must NOT inherit that:
 * "Sign in with Google/Microsoft/Apple" opens a popup, and if that popup lands in
 * the system browser the resulting cookies are written there instead of the mini
 * app's partition — the user completes the login and the webview still shows
 * them as signed out. So popups are kept in-app, in the *same* partition.
 */

interface MiniAppMatch {
  appId: string
  partition: string
  userAgent: string
}

/**
 * Which mini app a guest belongs to, or null if the session is not ours.
 * `session.fromPartition` is memoized by Electron, so comparing Session object
 * identity is a reliable partition lookup — Electron exposes no partition-name
 * accessor on WebContents.
 */
function findMiniApp(target: Session): MiniAppMatch | null {
  // Fast path: every app-owned window (main, quick assistant, selection bubble)
  // uses the default session. Checking this first avoids walking the app list —
  // and avoids `fromPartition` instantiating every mini app session — on each
  // ordinary window creation.
  if (target === session.defaultSession) return null

  let apps: { id: string; userAgent: string }[]
  try {
    apps = listMiniApps()
  } catch {
    // DB closed (shutdown / reset) — treat as not ours.
    return null
  }

  for (const a of apps) {
    const partition = getMiniAppPartition(a.id)
    if (session.fromPartition(partition) === target) {
      return { appId: a.id, partition, userAgent: resolveMiniAppUserAgent(a.userAgent) }
    }
  }
  return null
}

/** Permissions granted to embedded vendor sites. Everything else is denied. */
const ALLOWED_PERMISSIONS = new Set(['clipboard-read', 'clipboard-sanitized-write'])

/** Partitions whose permission handler is already installed. */
const permissionHandlerInstalled = new Set<string>()

/**
 * Install the global hook. Call once, before any window is created, so no guest
 * can attach before the handlers are in place.
 */
export function registerMiniAppWebContentsHook(): void {
  app.on('web-contents-created', (_event, contents) => {
    const type = contents.getType()
    // 'webview' is the embedded guest; 'window' covers OAuth popups it opens,
    // which share its partition and can themselves open nested popups.
    if (type !== 'webview' && type !== 'window') return

    const match = findMiniApp(contents.session)
    if (!match) return

    // Only popups need a UA set here — a <webview> already carries the
    // `useragent` attribute the renderer set from mini-app:get-runtime, and
    // overwriting it would discard any per-app override.
    if (type === 'window') contents.setUserAgent(match.userAgent)

    installPopupRouting(contents, match)
    installPermissionPolicy(contents.session, match.partition)
    // Guests only. An OAuth popup keeps the default Ctrl+W (close the popup),
    // which is what a browser would do.
    if (type === 'webview') installCloseTabShortcut(contents, match.appId)
  })
}

/**
 * Ctrl+W inside a guest page closes its tab rather than the app window.
 *
 * The host window's own `before-input-event` never sees this keystroke — focus
 * is in the guest, so the event is delivered to the guest's WebContents. Both
 * ends therefore need the same interception; see `createWindow` in ./index.ts
 * for the host half.
 */
function installCloseTabShortcut(contents: WebContents, appId: string): void {
  contents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    if (!input.control || input.shift || input.alt || input.meta) return
    if (input.key.toLowerCase() !== 'w') return

    event.preventDefault()
    getMainWindow()?.webContents.send(IpcChannels.MINI_APP_CLOSE_TAB_SHORTCUT, { appId })
  })
}

function installPopupRouting(contents: WebContents, match: MiniAppMatch): void {
  contents.setWindowOpenHandler(({ url }) => {
    // Only http(s) may open in-app. `mailto:`, `tel:` and custom schemes go to
    // the OS; anything unparseable is dropped.
    let scheme: string
    try {
      scheme = new URL(url).protocol
    } catch {
      return { action: 'deny' }
    }

    if (scheme !== 'http:' && scheme !== 'https:') {
      shell.openExternal(url).catch(() => {
        // ignore — nothing useful to do if the OS refuses
      })
      return { action: 'deny' }
    }

    // Keep the popup in-app and in the same partition, so cookies set during an
    // OAuth round-trip land where the webview can read them.
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: 520,
        height: 680,
        autoHideMenuBar: true,
        webPreferences: {
          partition: match.partition,
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
          // No preload: `window.api` must never be reachable from vendor pages.
        },
      },
    }
  })
}

function installPermissionPolicy(target: Session, partition: string): void {
  // Session-scoped, so once per partition rather than once per guest.
  if (permissionHandlerInstalled.has(partition)) return
  permissionHandlerInstalled.add(partition)
  target.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(ALLOWED_PERMISSIONS.has(permission))
  })
}
