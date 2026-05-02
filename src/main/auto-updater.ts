import { app, BrowserWindow, shell, net } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdaterState, UpdaterDownloadProgress } from '@shared/types'
import { IpcChannels } from '@shared/ipc-channels'
import { getAutoUpdateEnabled } from './app-state'

const GITHUB_OWNER = 'lastwhisper66'
const GITHUB_REPO = 'ai-studio'
const RELEASE_PAGE_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`
const STARTUP_CHECK_DELAY_MS = 5_000

const isMacFallback = process.platform === 'darwin'

let state: UpdaterState = {
  status: 'idle',
  currentVersion: app.getVersion(),
  isMacFallback,
}

let initialized = false

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

async function fetchLatestReleaseFromGitHub(): Promise<{
  version: string
  notes: string
  url: string
}> {
  return new Promise((resolve, reject) => {
    const request = net.request({
      method: 'GET',
      url: `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
      redirect: 'follow',
    })
    request.setHeader('Accept', 'application/vnd.github+json')
    request.setHeader('User-Agent', `${GITHUB_REPO}-updater`)

    let body = ''
    request.on('response', (response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        reject(new Error(`GitHub API responded with ${response.statusCode}`))
        return
      }
      response.on('data', (chunk) => {
        body += chunk.toString('utf-8')
      })
      response.on('end', () => {
        try {
          const json = JSON.parse(body) as {
            tag_name?: string
            body?: string
            html_url?: string
          }
          if (!json.tag_name) {
            reject(new Error('GitHub response missing tag_name'))
            return
          }
          resolve({
            version: json.tag_name.replace(/^v/, ''),
            notes: json.body ?? '',
            url: json.html_url ?? RELEASE_PAGE_URL,
          })
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)))
        }
      })
    })
    request.on('error', (err) => reject(err))
    request.end()
  })
}

async function checkViaGitHubApi(manual: boolean): Promise<void> {
  try {
    const latest = await fetchLatestReleaseFromGitHub()
    const cmp = compareVersions(latest.version, state.currentVersion)
    if (cmp > 0) {
      setState({
        status: 'available',
        latestVersion: latest.version,
        releaseNotes: latest.notes,
        releaseUrl: latest.url,
        manualCheck: manual,
        error: undefined,
      })
    } else {
      setState({ status: 'not-available', manualCheck: manual, error: undefined })
    }
  } catch (e) {
    setState({
      status: 'error',
      error: e instanceof Error ? e.message : String(e),
      manualCheck: manual,
    })
  }
}

function bindElectronUpdaterEvents(): void {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('checking-for-update', () => {
    setState({ status: 'checking', error: undefined })
  })
  autoUpdater.on('update-available', (info) => {
    setState({
      status: 'available',
      latestVersion: info.version,
      releaseNotes:
        typeof info.releaseNotes === 'string'
          ? info.releaseNotes
          : Array.isArray(info.releaseNotes)
            ? info.releaseNotes.map((n) => n.note ?? '').join('\n')
            : '',
      releaseUrl: RELEASE_PAGE_URL,
      error: undefined,
    })
  })
  autoUpdater.on('update-not-available', () => {
    setState({ status: 'not-available', error: undefined })
  })
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
    setState({ status: 'error', error: err?.message ?? String(err) })
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
  if (isMacFallback) {
    setState({ status: 'checking', manualCheck: manual, error: undefined })
    await checkViaGitHubApi(manual)
    return
  }
  try {
    setState({ status: 'checking', manualCheck: manual, error: undefined })
    // Don't await — events drive state transitions.
    await autoUpdater.checkForUpdates()
  } catch (e) {
    setState({
      status: 'error',
      error: e instanceof Error ? e.message : String(e),
      manualCheck: manual,
    })
  }
}

export async function downloadUpdate(): Promise<void> {
  if (isMacFallback) return
  try {
    setState({ status: 'downloading', downloadProgress: undefined, error: undefined })
    await autoUpdater.downloadUpdate()
  } catch (e) {
    setState({ status: 'error', error: e instanceof Error ? e.message : String(e) })
  }
}

export function quitAndInstall(): void {
  if (isMacFallback) return
  autoUpdater.quitAndInstall()
}

export function openReleasePage(): void {
  void shell.openExternal(state.releaseUrl ?? RELEASE_PAGE_URL)
}
