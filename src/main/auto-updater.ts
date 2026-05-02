import { app, BrowserWindow, shell, net } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { AppReleaseInfo, UpdaterState, UpdaterDownloadProgress } from '@shared/types'
import { IpcChannels } from '@shared/ipc-channels'
import { getAutoUpdateEnabled } from './app-state'

export const GITHUB_OWNER = 'lastwhisper66'
export const GITHUB_REPO = 'ai-studio'
export const PROJECT_PAGE_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`
export const RELEASES_PAGE_URL = `${PROJECT_PAGE_URL}/releases`
const RELEASE_PAGE_URL = `${RELEASES_PAGE_URL}/latest`
const STARTUP_CHECK_DELAY_MS = 5_000
const GITHUB_RELEASE_TIMEOUT_MS = 15_000

const isMacFallback = process.platform === 'darwin'

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
  return new Promise((resolve, reject) => {
    let settled = false
    const request = net.request({
      method: 'GET',
      url: `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
      redirect: 'follow',
    })
    const timeout = setTimeout(() => {
      if (settled) return
      settled = true
      request.abort()
      reject(
        new Error('GitHub release request timed out. Please check your network and try again.'),
      )
    }, GITHUB_RELEASE_TIMEOUT_MS)

    const finish = (callback: () => void): void => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      callback()
    }

    request.setHeader('Accept', 'application/vnd.github+json')
    request.setHeader('User-Agent', `${GITHUB_REPO}-updater`)

    let body = ''
    request.on('response', (response) => {
      response.on('data', (chunk) => {
        body += chunk.toString('utf-8')
      })
      response.on('error', (err) => finish(() => reject(err)))
      response.on('end', () => {
        finish(() => {
          try {
            const statusCode = response.statusCode ?? 0
            if (statusCode < 200 || statusCode >= 300) {
              reject(new Error(`GitHub API responded with ${statusCode}`))
              return
            }

            const json = JSON.parse(body) as {
              tag_name?: string
              name?: string
              body?: string
              html_url?: string
              published_at?: string
            }
            if (!json.tag_name) {
              reject(new Error('GitHub response missing tag_name'))
              return
            }
            resolve({
              version: json.tag_name.replace(/^v/, ''),
              name: json.name,
              notes: json.body ?? '',
              url: json.html_url ?? RELEASE_PAGE_URL,
              publishedAt: json.published_at,
            })
          } catch (e) {
            reject(e instanceof Error ? e : new Error(String(e)))
          }
        })
      })
    })
    request.on('error', (err) => finish(() => reject(err)))
    request.end()
  })
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
  try {
    const latest = await fetchLatestReleaseFromGitHub()
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
      })
    }
  } catch (e) {
    if (operationId !== checkOperationId) return

    setState({
      status: 'error',
      latestVersion: undefined,
      releaseNotes: undefined,
      releaseUrl: undefined,
      downloadProgress: undefined,
      error: getErrorMessage(e),
      manualCheck: activeCheckManual,
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
    setState({ status: 'error', error: err?.message ?? String(err), downloadProgress: undefined })
  })
}

export function initAutoUpdater(): void {
  if (initialized) return
  initialized = true
  if (!isMacFallback) bindElectronUpdaterEvents()

  if (!getAutoUpdateEnabled()) return

  setTimeout(() => {
    void checkForUpdates(false)
  }, STARTUP_CHECK_DELAY_MS)
}

export async function checkForUpdates(manual: boolean): Promise<void> {
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
