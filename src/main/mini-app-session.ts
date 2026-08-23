import { app, session, type Session } from 'electron'

/**
 * Mini App session plumbing.
 *
 * Two problems are solved here:
 *
 * 1. **Login persistence.** Each mini app runs in its own `persist:` partition,
 *    so Chromium writes cookies / localStorage / IndexedDB to
 *    `userData/Partitions/miniapp-<id>/` and logins survive a restart. One
 *    partition per app (rather than one shared one) keeps vendor cookies from
 *    leaking into each other.
 *
 * 2. **User-Agent masking.** Electron's default UA carries both the app name and
 *    an `Electron/x.y.z` token. Google's sign-in flow rejects UAs it recognizes
 *    as an embedded browser ("this browser or app may not be secure"), and some
 *    vendors' bot protection does the same. Stripping those two tokens leaves a
 *    stock-Chrome UA whose Chrome version still matches the real underlying
 *    Chromium, so nothing is spoofed beyond hiding the embedding.
 */

const PARTITION_PREFIX = 'miniapp-'

/** Chromium partition string for a mini app. `persist:` makes it survive restarts. */
export function getMiniAppPartition(appId: string): string {
  return `persist:${PARTITION_PREFIX}${appId}`
}

/** True for any partition owned by the Mini Apps feature. */
export function isMiniAppPartition(partition: string): boolean {
  return partition.startsWith(`persist:${PARTITION_PREFIX}`)
}

let cachedUserAgent: string | null = null

/**
 * Electron's default UA with the `Electron/*` and `<appName>/*` tokens removed.
 * Computed once and cached — `app.userAgentFallback` is stable after boot.
 */
export function getMiniAppUserAgent(): string {
  if (cachedUserAgent) return cachedUserAgent

  const appName = app.getName()
  cachedUserAgent = app.userAgentFallback
    .split(' ')
    // Drop `Electron/39.0.0` and `AI-Studio/1.0.0`-style tokens. Matching on the
    // `<name>/` prefix (rather than a fixed version pattern) keeps this correct
    // across Electron upgrades and app renames.
    .filter((token) => !token.startsWith('Electron/') && !token.startsWith(`${appName}/`))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()

  return cachedUserAgent
}

/**
 * Resolve the UA for one app: an explicit per-app override wins, otherwise the
 * shared masked UA. Some vendors only serve their full desktop UI to specific
 * UAs, so the DB keeps an optional override column.
 */
export function resolveMiniAppUserAgent(override: string): string {
  const trimmed = override.trim()
  return trimmed.length > 0 ? trimmed : getMiniAppUserAgent()
}

/** The Session object for a mini app, creating it on first access. */
export function getMiniAppSession(appId: string): Session {
  return session.fromPartition(getMiniAppPartition(appId))
}

const CLEARABLE_STORAGES = [
  'cookies',
  'localstorage',
  'indexdb',
  'websql',
  'serviceworkers',
  'cachestorage',
] as const

/**
 * Wipe one mini app's login state. Clears storage through Chromium rather than
 * deleting the partition directory: the directory may be memory-mapped by a live
 * webview, and Electron owns its layout.
 */
export async function clearMiniAppSession(appId: string): Promise<void> {
  const target = getMiniAppSession(appId)
  await target.clearStorageData({ storages: [...CLEARABLE_STORAGES] })
  await target.clearCache()
}

/**
 * Wipe every known mini app partition. Called from `app:reset`, which otherwise
 * only clears `session.defaultSession` and would leave vendor logins behind.
 *
 * Takes the id list from the caller because a partition is only reachable via
 * `fromPartition` once its id is known — Electron exposes no partition registry.
 */
export async function clearAllMiniAppSessions(appIds: string[]): Promise<void> {
  await Promise.all(
    appIds.map(async (id) => {
      try {
        await clearMiniAppSession(id)
      } catch {
        // best-effort — one failure should not abort a full reset
      }
    }),
  )
}
