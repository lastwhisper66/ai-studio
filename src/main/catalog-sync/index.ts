/**
 * OpenRouter 模型目录同步引擎。
 *
 * - 启动期由 `scheduleCatalogSync()` 触发(条件:库为空 或 距上次同步 > 阈值天数)。
 * - 用户在 Settings 点"立即同步"触发 `syncCatalog()`。
 * - 同步过程会通过 BrowserWindow.webContents 推送 `CATALOG_STATUS_CHANGED` 事件。
 *
 * 错误处理:
 * - 失败时 `lastSyncStatus = 'error'`、`lastSyncError = '<code>'`、`lastSyncAt` 不更新。
 * - 不自动重试;由用户手动点"重试"。
 *
 * 并发:同时只允许一次进行中,重复调用会复用同一 Promise。
 */

import { randomUUID } from 'crypto'
import { BrowserWindow } from 'electron'
import { getDb } from '../db/database'
import { countModelDefinitions } from '../db/model-definitions'
import { getSetting, setSetting } from '../db/settings'
import { IpcChannels } from '@shared/ipc-channels'
import type { CatalogSyncResult, CatalogSyncStatus } from '@shared/types'
import { fetchModels, fetchProviders, OpenRouterHttpError } from './openrouter-client'
import { mapOpenRouter } from './mapper'

const SETTING_LAST_SYNC_AT = 'catalog.lastSyncAt'
const SETTING_LAST_SYNC_STATUS = 'catalog.lastSyncStatus'
const SETTING_LAST_SYNC_ERROR = 'catalog.lastSyncError'
const SETTING_REFRESH_INTERVAL_DAYS = 'catalog.refreshIntervalDays'
const DEFAULT_REFRESH_INTERVAL_DAYS = 7

let inFlight: Promise<CatalogSyncResult> | null = null
let abortController: AbortController | null = null

export function getSyncStatus(): CatalogSyncStatus {
  return {
    lastSyncAt: getSetting(SETTING_LAST_SYNC_AT) ?? null,
    lastSyncStatus:
      (getSetting(SETTING_LAST_SYNC_STATUS) as CatalogSyncStatus['lastSyncStatus']) ?? null,
    lastSyncError: getSetting(SETTING_LAST_SYNC_ERROR) ?? null,
    isInFlight: inFlight !== null,
  }
}

/**
 * 启动期调度。fire-and-forget,不阻塞 boot,失败也不抛出。
 */
export function scheduleCatalogSync(): void {
  const defCount = countModelDefinitions()
  const lastSync = getSetting(SETTING_LAST_SYNC_AT)
  const intervalRaw = getSetting(SETTING_REFRESH_INTERVAL_DAYS)
  const intervalDays = intervalRaw ? Number(intervalRaw) : DEFAULT_REFRESH_INTERVAL_DAYS
  const safeInterval =
    Number.isFinite(intervalDays) && intervalDays > 0 ? intervalDays : DEFAULT_REFRESH_INTERVAL_DAYS

  const shouldSync =
    defCount === 0 ||
    !lastSync ||
    Date.now() - new Date(lastSync).getTime() > safeInterval * 86_400_000

  if (shouldSync) {
    void syncCatalog().catch((err) => {
      console.error('[catalog-sync] background sync failed:', err)
    })
  }
}

/** 立即同步。重复调用复用同一进行中的 Promise。 */
export function syncCatalog(): Promise<CatalogSyncResult> {
  if (inFlight) return inFlight
  abortController = new AbortController()
  const signal = abortController.signal
  inFlight = doSync(signal).finally(() => {
    inFlight = null
    abortController = null
    broadcastStatus()
  })
  broadcastStatus()
  return inFlight
}

/** 取消进行中的同步(用于应用退出前)。 */
export function cancelSync(): void {
  abortController?.abort()
}

async function doSync(signal: AbortSignal): Promise<CatalogSyncResult> {
  const startedAt = Date.now()
  try {
    const [providers, models] = await Promise.all([fetchProviders(signal), fetchModels(signal)])
    const { definitions, skippedCount } = mapOpenRouter(providers, models)

    const db = getDb()
    // 用户编辑保护:`updated_at = created_at` 表示"从未被用户编辑过"。
    //   - INSERT 新行时 SQLite 在同一 statement 内 datetime('now') 返回一致值,
    //     两个 DEFAULT 列同时落地,初始等式成立。
    //   - 同步路径 ON CONFLICT UPDATE 时**不动 `updated_at`**,保持等式不变 →
    //     后续每次 sync 仍能覆盖 OpenRouter 上游变化(capabilities / context_window /
    //     reasoning_efforts)。
    //   - 用户在 UI 编辑走 `updateModelDefinition`,显式 SET updated_at = datetime('now'),
    //     等式破裂 → 后续 sync 的 WHERE 为 false,该行被锁定不再被覆盖。
    const insertDef = db.prepare(
      `INSERT INTO model_definitions
         (id, name, group_name, capabilities, context_window, reasoning_efforts)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET
         group_name = excluded.group_name,
         capabilities = excluded.capabilities,
         context_window = excluded.context_window,
         reasoning_efforts = excluded.reasoning_efforts
       WHERE updated_at = created_at`,
    )

    // Note: `model_groups` is NOT touched by sync — it's reserved for
    // user-defined groups. UI groups definitions by `def.group` directly.
    db.transaction(() => {
      for (const d of definitions) {
        insertDef.run(
          randomUUID(),
          d.name,
          d.group,
          JSON.stringify(d.capabilities),
          d.contextWindow ?? null,
          d.reasoningEfforts === null ? null : JSON.stringify(d.reasoningEfforts),
        )
      }
    })()

    const durationMs = Date.now() - startedAt
    setSetting(SETTING_LAST_SYNC_AT, new Date().toISOString())
    setSetting(SETTING_LAST_SYNC_STATUS, 'ok')
    setSetting(SETTING_LAST_SYNC_ERROR, '')
    return {
      definitionsCount: definitions.length,
      groupsCount: 0,
      durationMs,
      skippedCount,
    }
  } catch (err) {
    const code = classifyError(err, signal)
    setSetting(SETTING_LAST_SYNC_STATUS, 'error')
    setSetting(SETTING_LAST_SYNC_ERROR, code)
    throw err
  }
}

function classifyError(err: unknown, signal: AbortSignal): string {
  if (signal.aborted) return 'network'
  if (err instanceof OpenRouterHttpError) return `http_${err.status}`
  if (err instanceof SyntaxError) return 'parse'
  if (err instanceof Error && /timeout|abort|fetch failed/i.test(err.message)) return 'network'
  return 'parse'
}

function broadcastStatus(): void {
  const status = getSyncStatus()
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) {
      w.webContents.send(IpcChannels.CATALOG_STATUS_CHANGED, status)
    }
  }
}
