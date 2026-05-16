import { app, BrowserWindow, shell, net } from 'electron'
import { autoUpdater } from 'electron-updater'
import type {
  AppReleaseInfo,
  UpdaterErrorCode,
  UpdaterErrorMeta,
  UpdaterState,
  UpdaterDownloadProgress,
} from '@shared/types'
import { IpcChannels } from '@shared/ipc-channels'
import { getAutoUpdateEnabled } from './app-state'

export const GITHUB_OWNER = 'lastwhisper66'
export const GITHUB_REPO = 'ai-studio'
export const PROJECT_PAGE_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`
export const RELEASES_PAGE_URL = `${PROJECT_PAGE_URL}/releases`
const RELEASE_PAGE_URL = `${RELEASES_PAGE_URL}/latest`
const ATOM_FEED_URL = `${PROJECT_PAGE_URL}/releases.atom`
const STARTUP_CHECK_DELAY_MS = 5_000
const GITHUB_RELEASE_TIMEOUT_MS = 15_000

const isMacFallback = process.platform === 'darwin'

class UpdaterFetchError extends Error {
  readonly code: UpdaterErrorCode
  readonly meta?: UpdaterErrorMeta

  constructor(message: string, code: UpdaterErrorCode, meta?: UpdaterErrorMeta) {
    super(message)
    this.name = 'UpdaterFetchError'
    this.code = code
    this.meta = meta
  }
}

let state: UpdaterState = {
  status: 'idle',
  currentVersion: app.getVersion(),
  isMacFallback,
}

let initialized = false
let checkOperationId = 0
let activeCheckId = 0
let activeCheckManual = false
let activeCheckPromise: Promise<void> | null = null

function setState(patch: Partial<UpdaterState>): void {
  state = { ...state, ...patch }
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    win.webContents.send(IpcChannels.UPDATER_STATE_CHANGED, state)
  }
}

export function getUpdaterState(): UpdaterState {
  return state
}

/** Semantic version compare: returns 1 if a > b, -1 if a < b, 0 if equal. Accepts both "1.2.3" and "v1.2.3". */
function compareVersions(a: string, b: string): number {
  const parse = (s: string): number[] =>
    s
      .replace(/^v/, '')
      .split(/[.-]/)
      .slice(0, 3)
      .map((x) => parseInt(x, 10) || 0)
  const pa = parse(a)
  const pb = parse(b)
  for (let i = 0; i < 3; i++) {
    const av = pa[i] ?? 0
    const bv = pb[i] ?? 0
    if (av > bv) return 1
    if (av < bv) return -1
  }
  return 0
}

interface HttpResponse {
  statusCode: number
  headers: Record<string, string | string[]>
  body: string
}

/** GET helper built on Electron `net.request` with a single timeout. */
function httpGet(url: string, headers: Record<string, string>): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    let settled = false
    const request = net.request({ method: 'GET', url, redirect: 'follow' })
    const timeout = setTimeout(() => {
      if (settled) return
      settled = true
      request.abort()
      reject(
        new UpdaterFetchError(
          `Request to ${url} timed out after ${GITHUB_RELEASE_TIMEOUT_MS}ms`,
          'network',
        ),
      )
    }, GITHUB_RELEASE_TIMEOUT_MS)

    const finish = (callback: () => void): void => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      callback()
    }

    for (const [key, value] of Object.entries(headers)) {
      request.setHeader(key, value)
    }

    let body = ''
    request.on('response', (response) => {
      response.on('data', (chunk) => {
        body += chunk.toString('utf-8')
      })
      response.on('error', (err) =>
        finish(() =>
          reject(
            err instanceof UpdaterFetchError
              ? err
              : new UpdaterFetchError(err?.message ?? String(err), 'network'),
          ),
        ),
      )
      response.on('end', () => {
        finish(() =>
          resolve({
            statusCode: response.statusCode ?? 0,
            headers: response.headers as Record<string, string | string[]>,
            body,
          }),
        )
      })
    })
    request.on('error', (err) =>
      finish(() => reject(new UpdaterFetchError(err?.message ?? String(err), 'network'))),
    )
    request.end()
  })
}

function pickHeader(headers: Record<string, string | string[]>, name: string): string | undefined {
  const value = headers[name] ?? headers[name.toLowerCase()]
  if (Array.isArray(value)) return value[0]
  return value
}

/** Decode the XML entities Atom uses to escape HTML inside `<content>`. */
function decodeXmlEntities(input: string): string {
  return input
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&amp;/g, '&')
}

/** Returns true for plain semver tags like `1.2.3` / `v1.2.3`; false for pre-releases (`-rc.1`, `-beta`). */
function isStableTag(tag: string): boolean {
  return /^v?\d+\.\d+\.\d+$/.test(tag)
}

function normalizeReleaseNotes(releaseNotes: unknown): string {
  if (typeof releaseNotes === 'string') return releaseNotes
  if (!Array.isArray(releaseNotes)) return ''

  return releaseNotes
    .map((item) =>
      item && typeof item === 'object' && 'note' in item
        ? String((item as { note?: unknown }).note ?? '')
        : '',
    )
    .join('\n')
}

export async function fetchLatestReleaseFromGitHub(): Promise<AppReleaseInfo> {
  const response = await httpGet(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
    {
      Accept: 'application/vnd.github+json',
      'User-Agent': `${GITHUB_REPO}-updater`,
    },
  )

  if (response.statusCode === 403) {
    const remaining = pickHeader(response.headers, 'x-ratelimit-remaining')
    const resetEpoch = Number(pickHeader(response.headers, 'x-ratelimit-reset'))
    const lowerBody = response.body.toLowerCase()
    if (remaining === '0' && Number.isFinite(resetEpoch) && resetEpoch > 0) {
      throw new UpdaterFetchError(
        `GitHub API primary rate limit exceeded (resets at ${new Date(resetEpoch * 1000).toISOString()})`,
        'rate-limit-primary',
        { statusCode: 403, resetAt: new Date(resetEpoch * 1000).toISOString() },
      )
    }
    if (lowerBody.includes('secondary rate limit') || lowerBody.includes('abuse')) {
      throw new UpdaterFetchError(
        'GitHub API secondary rate limit triggered',
        'rate-limit-secondary',
        { statusCode: 403 },
      )
    }
    throw new UpdaterFetchError(`GitHub API responded with 403`, 'http', { statusCode: 403 })
  }

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new UpdaterFetchError(`GitHub API responded with ${response.statusCode}`, 'http', {
      statusCode: response.statusCode,
    })
  }

  let json: {
    tag_name?: string
    name?: string
    body?: string
    html_url?: string
    published_at?: string
  }
  try {
    json = JSON.parse(response.body)
  } catch (e) {
    throw new UpdaterFetchError(
      `Failed to parse GitHub API response: ${e instanceof Error ? e.message : String(e)}`,
      'parse',
    )
  }
  if (!json.tag_name) {
    throw new UpdaterFetchError('GitHub response missing tag_name', 'parse')
  }
  return {
    version: json.tag_name.replace(/^v/, ''),
    name: json.name,
    notes: json.body ?? '',
    url: json.html_url ?? RELEASE_PAGE_URL,
    publishedAt: json.published_at,
  }
}

/**
 * Fetch the latest stable release via the `releases.atom` feed served from
 * `github.com` (not `api.github.com`). Unlike the JSON API, the Atom feed is
 * not subject to the 60-requests-per-hour unauthenticated rate limit, so this
 * is the preferred primary path. We fall back to the JSON API only if Atom
 * parsing fails or yields no stable entry.
 */
export async function fetchLatestReleaseFromAtom(): Promise<AppReleaseInfo> {
  const response = await httpGet(ATOM_FEED_URL, {
    Accept: 'application/atom+xml, application/xml;q=0.9, */*;q=0.5',
    'User-Agent': `${GITHUB_REPO}-updater`,
  })

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new UpdaterFetchError(`GitHub Atom feed responded with ${response.statusCode}`, 'http', {
      statusCode: response.statusCode,
    })
  }

  const xml = response.body
  const entryRegex = /<entry\b[\s\S]*?<\/entry>/g
  let match: RegExpExecArray | null
  while ((match = entryRegex.exec(xml)) !== null) {
    const block = match[0]
    const linkMatch = block.match(
      /<link\b[^>]*\brel=["']alternate["'][^>]*\bhref=["']([^"']+)["'][^>]*\/?>/i,
    )
    const url = linkMatch?.[1] ?? ''
    const tagMatch = url.match(/\/releases\/tag\/([^/?#]+)/)
    const tag = tagMatch?.[1] ? decodeURIComponent(tagMatch[1]) : ''
    if (!tag || !isStableTag(tag)) continue

    const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/)
    const updatedMatch = block.match(/<updated>([\s\S]*?)<\/updated>/)
    const contentMatch = block.match(/<content\b[^>]*>([\s\S]*?)<\/content>/i)

    return {
      version: tag.replace(/^v/, ''),
      name: titleMatch?.[1] ? decodeXmlEntities(titleMatch[1].trim()) : undefined,
      notes: contentMatch?.[1] ? decodeXmlEntities(contentMatch[1].trim()) : '',
      url: url || RELEASE_PAGE_URL,
      publishedAt: updatedMatch?.[1]?.trim(),
    }
  }
  throw new UpdaterFetchError('Atom feed contained no stable release entry', 'parse')
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function invalidateActiveCheck(): void {
  checkOperationId++
  activeCheckId = 0
  activeCheckManual = false
  activeCheckPromise = null
}

async function runGitHubUpdateCheck(operationId: number): Promise<void> {
  let latest: AppReleaseInfo
  try {
    // Prefer the rate-limit-free Atom feed. Fall back to api.github.com only
    // if Atom is unreachable or returns no parseable stable entry.
    try {
      latest = await fetchLatestReleaseFromAtom()
    } catch (atomErr) {
      if (operationId !== checkOperationId) return
      latest = await fetchLatestReleaseFromGitHub()
      void atomErr
    }
  } catch (e) {
    if (operationId !== checkOperationId) return
    const fetchErr = e instanceof UpdaterFetchError ? e : undefined
    setState({
      status: 'error',
      latestVersion: undefined,
      releaseNotes: undefined,
      releaseUrl: undefined,
      downloadProgress: undefined,
      error: getErrorMessage(e),
      errorCode: fetchErr?.code,
      errorMeta: fetchErr?.meta,
      manualCheck: activeCheckManual,
    })
    return
  }

  if (operationId !== checkOperationId) return

  const cmp = compareVersions(latest.version, state.currentVersion)
  const manualCheck = activeCheckManual
  if (cmp > 0) {
    setState({
      status: 'available',
      latestVersion: latest.version,
      releaseNotes: latest.notes,
      releaseUrl: latest.url,
      manualCheck,
      error: undefined,
      errorCode: undefined,
      errorMeta: undefined,
      downloadProgress: undefined,
    })
  } else {
    setState({
      status: 'not-available',
      latestVersion: undefined,
      releaseNotes: undefined,
      releaseUrl: undefined,
      downloadProgress: undefined,
      manualCheck,
      error: undefined,
      errorCode: undefined,
      errorMeta: undefined,
    })
  }
}

function bindElectronUpdaterEvents(): void {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('download-progress', (progress) => {
    const p: UpdaterDownloadProgress = {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    }
    setState({ status: 'downloading', downloadProgress: p })
  })
  autoUpdater.on('update-downloaded', () => {
    setState({ status: 'downloaded' })
  })
  autoUpdater.on('error', (err) => {
    setState({
      status: 'error',
      error: err?.message ?? String(err),
      errorCode: undefined,
      errorMeta: undefined,
      downloadProgress: undefined,
    })
  })
}

export function initAutoUpdater(): void {
  if (initialized) return
  initialized = true

  // Skip update checks in development / unpackaged builds.
  // The version in package.json on a feature branch trails main (release-please
  // bumps it only via the merged Release PR), so the updater would constantly
  // report a newer remote version that doesn't actually apply locally.
  if (!app.isPackaged) {
    setState({ status: 'not-available' })
    return
  }

  if (!isMacFallback) bindElectronUpdaterEvents()

  if (!getAutoUpdateEnabled()) return

  setTimeout(() => {
    void checkForUpdates(false)
  }, STARTUP_CHECK_DELAY_MS)
}

export async function checkForUpdates(manual: boolean): Promise<void> {
  if (!app.isPackaged) {
    setState({
      status: 'not-available',
      manualCheck: manual,
      latestVersion: undefined,
      releaseNotes: undefined,
      releaseUrl: undefined,
      downloadProgress: undefined,
      error: undefined,
    })
    return
  }

  if (activeCheckPromise) {
    if (manual && !activeCheckManual) {
      activeCheckManual = true
      if (state.status === 'checking') {
        setState({ manualCheck: true })
      }
    }
    return activeCheckPromise
  }

  const operationId = ++checkOperationId
  activeCheckId = operationId
  activeCheckManual = manual
  setState({
    status: 'checking',
    manualCheck: manual,
    error: undefined,
    errorCode: undefined,
    errorMeta: undefined,
    downloadProgress: undefined,
  })

  activeCheckPromise = runGitHubUpdateCheck(operationId).finally(() => {
    if (activeCheckId === operationId) {
      activeCheckId = 0
      activeCheckManual = false
      activeCheckPromise = null
    }
  })
  return activeCheckPromise
}

export async function downloadUpdate(): Promise<void> {
  if (isMacFallback) return
  if (!app.isPackaged) {
    setState({ status: 'not-available', manualCheck: true, error: undefined })
    return
  }
  invalidateActiveCheck()
  try {
    setState({
      status: 'downloading',
      manualCheck: true,
      downloadProgress: undefined,
      error: undefined,
    })
    const result = await autoUpdater.checkForUpdates()
    const latestVersion = result?.updateInfo?.version
    if (!result?.isUpdateAvailable || !latestVersion) {
      setState({
        status: 'not-available',
        latestVersion: undefined,
        releaseNotes: undefined,
        releaseUrl: undefined,
        downloadProgress: undefined,
        manualCheck: true,
        error: undefined,
      })
      return
    }

    setState({
      status: 'downloading',
      latestVersion,
      releaseNotes: normalizeReleaseNotes(result.updateInfo.releaseNotes),
      releaseUrl: RELEASE_PAGE_URL,
      manualCheck: true,
      error: undefined,
    })
    await autoUpdater.downloadUpdate()
  } catch (e) {
    setState({
      status: 'error',
      error: getErrorMessage(e),
      errorCode: undefined,
      errorMeta: undefined,
      manualCheck: true,
      downloadProgress: undefined,
    })
  }
}

export function quitAndInstall(): void {
  if (isMacFallback) return
  autoUpdater.quitAndInstall()
}

export function openReleasePage(): void {
  void shell.openExternal(state.releaseUrl ?? RELEASE_PAGE_URL)
}
