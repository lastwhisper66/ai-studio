import { create } from 'zustand'
import type {
  BackupFileMeta,
  BackupImportMode,
  BackupProgress,
  BackupSummary,
  RemoteBackupItem,
  RemoteConfig,
  RemoteConfigs,
  RemoteType,
  RollbackBackupItem,
  SyncResult,
  SyncStatus,
} from '@shared/types'
import type { LocalizedError } from '@shared/errors'

const fallbackError = (e: LocalizedError | undefined): LocalizedError =>
  e ?? { code: 'errors.internal' }

interface BackupState {
  status: SyncStatus | null
  /** Both remote configs: each may be null when that remote isn't configured. */
  remoteConfigs: RemoteConfigs
  progress: BackupProgress | null
  isLoadingStatus: boolean

  loadStatus: () => Promise<void>
  loadRemoteConfigs: () => Promise<void>

  exportToFile: (password: string) => Promise<{ filePath: string } | { error: LocalizedError }>
  peekFile: (filePath: string) => Promise<BackupFileMeta | { error: LocalizedError }>
  importFromFile: (
    filePath: string | undefined,
    password: string,
    mode: BackupImportMode,
  ) => Promise<BackupSummary | { error: LocalizedError }>

  setRemoteConfig: (cfg: RemoteConfig) => Promise<void | { error: LocalizedError }>
  clearRemoteConfig: (type: RemoteType) => Promise<void>
  testRemote: (
    cfg: RemoteConfig,
  ) => Promise<{ ok: boolean; latency?: number; error?: LocalizedError }>

  syncNow: () => Promise<SyncResult | { error: LocalizedError }>
  cancelSync: () => Promise<void>
  listRemote: (type: RemoteType) => Promise<RemoteBackupItem[] | { error: LocalizedError }>
  listRollbacks: () => Promise<RollbackBackupItem[] | { error: LocalizedError }>
  restoreFromRemote: (
    type: RemoteType,
    key: string,
    password: string,
    mode: BackupImportMode,
  ) => Promise<void | { error: LocalizedError }>

  /** Internal — set by initBackupStore. */
  _detach: (() => void) | null
}

const emptyConfigs: RemoteConfigs = { webdav: null, s3: null }

export const useBackupStore = create<BackupState>((set, get) => ({
  status: null,
  remoteConfigs: emptyConfigs,
  progress: null,
  isLoadingStatus: false,
  _detach: null,

  loadStatus: async () => {
    set({ isLoadingStatus: true })
    const r = await window.api.backup.getStatus()
    set({ isLoadingStatus: false, status: r.success ? (r.data ?? null) : null })
  },

  loadRemoteConfigs: async () => {
    const r = await window.api.backup.getRemoteConfig()
    set({ remoteConfigs: r.success && r.data ? r.data : emptyConfigs })
  },

  exportToFile: async (password) => {
    const r = await window.api.backup.exportToFile(password)
    set({ progress: null })
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
    set({ progress: null })
    if (r.success && r.data) {
      // After import, refresh status (lastLocalChangeAt etc may have shifted).
      get().loadStatus()
      return r.data.applied
    }
    return { error: fallbackError(r.error) }
  },

  setRemoteConfig: async (cfg) => {
    const r = await window.api.backup.setRemoteConfig(cfg)
    if (r.success) {
      get().loadRemoteConfigs()
      get().loadStatus()
      return
    }
    return { error: fallbackError(r.error) }
  },

  clearRemoteConfig: async (type) => {
    await window.api.backup.clearRemoteConfig(type)
    get().loadRemoteConfigs()
    get().loadStatus()
  },

  testRemote: async (cfg) => {
    const r = await window.api.backup.testRemote(cfg)
    if (r.success && r.data) return r.data
    return { ok: false, error: fallbackError(r.error) }
  },

  syncNow: async () => {
    const r = await window.api.backup.syncNow()
    set({ progress: null })
    if (r.success && r.data) {
      get().loadStatus()
      return r.data
    }
    return { error: fallbackError(r.error) }
  },

  cancelSync: async () => {
    await window.api.backup.syncCancel()
  },

  listRemote: async (type) => {
    const r = await window.api.backup.listRemote(type)
    if (r.success && r.data) return r.data
    return { error: fallbackError(r.error) }
  },

  listRollbacks: async () => {
    const r = await window.api.backup.listRollbacks()
    if (r.success && r.data) return r.data
    return { error: fallbackError(r.error) }
  },

  restoreFromRemote: async (type, key, password, mode) => {
    const r = await window.api.backup.restoreFromRemote({ type, key, password, mode })
    set({ progress: null })
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
  store.loadRemoteConfigs()

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
