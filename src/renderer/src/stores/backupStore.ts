import { create } from 'zustand'
import type {
  BackupFileMeta,
  BackupImportMode,
  BackupProgress,
  BackupSummary,
  RemoteBackupItem,
  RemoteConfig,
  SyncResult,
  SyncStatus,
} from '@shared/types'
import type { LocalizedError } from '@shared/errors'

const fallbackError = (e: LocalizedError | undefined): LocalizedError =>
  e ?? { code: 'errors.internal' }

interface BackupState {
  status: SyncStatus | null
  remoteConfig: RemoteConfig | null
  progress: BackupProgress | null
  isLoadingStatus: boolean

  loadStatus: () => Promise<void>
  loadRemoteConfig: () => Promise<void>

  exportToFile: (password: string) => Promise<{ filePath: string } | { error: LocalizedError }>
  peekFile: (filePath: string) => Promise<BackupFileMeta | { error: LocalizedError }>
  importFromFile: (
    filePath: string | undefined,
    password: string,
    mode: BackupImportMode,
  ) => Promise<BackupSummary | { error: LocalizedError }>

  setRemoteConfig: (
    cfg: RemoteConfig,
    passphrase?: string,
  ) => Promise<void | { error: LocalizedError }>
  clearRemoteConfig: () => Promise<void>
  testRemote: (
    cfg: RemoteConfig,
  ) => Promise<{ ok: boolean; latency?: number; error?: LocalizedError }>

  syncNow: () => Promise<SyncResult | { error: LocalizedError }>
  cancelSync: () => Promise<void>
  listRemote: () => Promise<RemoteBackupItem[] | { error: LocalizedError }>
  restoreFromRemote: (
    key: string,
    password: string,
    mode: BackupImportMode,
  ) => Promise<void | { error: LocalizedError }>

  /** Internal — set by initBackupStore. */
  _detach: (() => void) | null
}

export const useBackupStore = create<BackupState>((set, get) => ({
  status: null,
  remoteConfig: null,
  progress: null,
  isLoadingStatus: false,
  _detach: null,

  loadStatus: async () => {
    set({ isLoadingStatus: true })
    const r = await window.api.backup.getStatus()
    set({ isLoadingStatus: false, status: r.success ? (r.data ?? null) : null })
  },

  loadRemoteConfig: async () => {
    const r = await window.api.backup.getRemoteConfig()
    set({ remoteConfig: r.success ? (r.data ?? null) : null })
  },

  exportToFile: async (password) => {
    const r = await window.api.backup.exportToFile(password)
    if (r.success && r.data) return r.data
    return { error: fallbackError(r.error) }
  },

  peekFile: async (filePath) => {
    const r = await window.api.backup.peekFile(filePath)
    if (r.success && r.data) return r.data
    return { error: fallbackError(r.error) }
  },

  importFromFile: async (filePath, password, mode) => {
    const r = await window.api.backup.importFromFile({ filePath, password, mode })
    if (r.success && r.data) {
      // After import, refresh status (lastLocalChangeAt etc may have shifted).
      get().loadStatus()
      return r.data.applied
    }
    return { error: fallbackError(r.error) }
  },

  setRemoteConfig: async (cfg, passphrase) => {
    const r = await window.api.backup.setRemoteConfig(cfg, passphrase)
    if (r.success) {
      get().loadRemoteConfig()
      get().loadStatus()
      return
    }
    return { error: fallbackError(r.error) }
  },

  clearRemoteConfig: async () => {
    await window.api.backup.clearRemoteConfig()
    set({ remoteConfig: null })
    get().loadStatus()
  },

  testRemote: async (cfg) => {
    const r = await window.api.backup.testRemote(cfg)
    if (r.success && r.data) return r.data
    return { ok: false, error: fallbackError(r.error) }
  },

  syncNow: async () => {
    const r = await window.api.backup.syncNow()
    if (r.success && r.data) {
      get().loadStatus()
      return r.data
    }
    return { error: fallbackError(r.error) }
  },

  cancelSync: async () => {
    await window.api.backup.syncCancel()
  },

  listRemote: async () => {
    const r = await window.api.backup.listRemote()
    if (r.success && r.data) return r.data
    return { error: fallbackError(r.error) }
  },

  restoreFromRemote: async (key, password, mode) => {
    const r = await window.api.backup.restoreFromRemote({ key, password, mode })
    if (r.success) {
      get().loadStatus()
      return
    }
    return { error: fallbackError(r.error) }
  },
}))

export function initBackupStore(): void {
  const store = useBackupStore.getState()
  store.loadStatus()
  store.loadRemoteConfig()

  const detachStatus = window.api.backup.onStatusChanged((s) => {
    useBackupStore.setState({ status: s })
  })
  const detachProgress = window.api.backup.onProgress((p) => {
    useBackupStore.setState({ progress: p })
  })
  useBackupStore.setState({
    _detach: () => {
      detachStatus()
      detachProgress()
    },
  })
}
