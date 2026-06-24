import { create } from 'zustand'
import type { CatalogSyncStatus } from '@shared/types'
import { useModelDefinitionStore } from './modelDefinitionStore'
import { useModelGroupStore } from './modelGroupStore'

interface CatalogSyncState {
  status: CatalogSyncStatus
  /** 由 catalog:status-changed push 自动维护 */
  init: () => Promise<void>
  syncNow: () => Promise<void>
}

const initialStatus: CatalogSyncStatus = {
  lastSyncAt: null,
  lastSyncStatus: null,
  lastSyncError: null,
  isInFlight: false,
}

let unsubscribe: (() => void) | null = null

export const useCatalogSyncStore = create<CatalogSyncState>((set, get) => ({
  status: initialStatus,

  init: async () => {
    const result = await window.api.catalog.getStatus()
    if (result.success && result.data) {
      set({ status: result.data })
    }
    // 订阅 push 事件
    if (!unsubscribe) {
      unsubscribe = window.api.catalog.onStatusChanged((newStatus) => {
        const prev = get().status
        set({ status: newStatus })
        // 一次成功的同步刚刚完成时,刷新渲染端缓存的 model_definitions / model_groups,
        // 否则用户必须重启应用才能看到目录变化。
        // 用 lastSyncAt 变化作为判据,可同时覆盖"用户手动点立即同步"和
        // "启动期后台自动同步"两种场景,也避免重复触发。
        if (
          newStatus.lastSyncStatus === 'ok' &&
          newStatus.lastSyncAt &&
          newStatus.lastSyncAt !== prev.lastSyncAt
        ) {
          void useModelDefinitionStore.getState().load()
          void useModelGroupStore.getState().load()
        }
      })
    }
  },

  syncNow: async () => {
    // 乐观切换 isInFlight,后端 broadcastStatus 会更新精确状态
    set({ status: { ...get().status, isInFlight: true } })
    await window.api.catalog.syncNow()
    // 后端 broadcast 已经把 status 更新;这里无需再 set
  },
}))
