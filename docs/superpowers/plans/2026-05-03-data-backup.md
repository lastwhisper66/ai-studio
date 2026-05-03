# 数据备份与云端同步 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 AI Studio 增加"配置备份"功能：本地导出/导入加密备份文件，以及通过 WebDAV 或 S3 兼容存储进行多设备云端同步（手动 + 定时，LWW 冲突解决）。

**Architecture:** main 进程持有所有 DB 读写、加密、远端 IO；通过 `BackupRemote` 接口隔离 WebDAV/S3 实现。备份文件 = 明文 JSON 头 + AES-256-GCM 加密的 base64 payload。同步引擎用一个 `manifest.json` 做 LWW 决策，先传 backup 再更新 manifest 保证崩溃安全。

**Tech Stack:** Node `crypto`（加密，零依赖）、`s3-lite-client`（S3 兼容传输，~100KB）、原生 fetch（WebDAV）、better-sqlite3（事务）、Zustand 5（renderer 状态）、Shadcn/UI（对话框/表单）。

**Spec 引用：** [`docs/superpowers/specs/2026-05-03-data-backup-design.md`](../specs/2026-05-03-data-backup-design.md)

**测试策略：** 用户明确要求**不引入测试基础设施**——所有任务只做实现 + 类型检查 + 阶段末手动冒烟。

---

## 文件结构

### Create

| 路径 | 职责 |
|---|---|
| `src/main/backup/crypto.ts` | PBKDF2 派生 + AES-256-GCM 加解密 |
| `src/main/backup/codec.ts` | `.aibackup` 文件格式编解码（含 magic、schemaVersion 校验） |
| `src/main/backup/snapshot.ts` | `collectSnapshot()` / `applySnapshot()` |
| `src/main/backup/index.ts` | 对外门面：`exportToFile` / `importFromFile` / `peekFile` |
| `src/main/backup/dirty-tracker.ts` | IPC handler 包装层，更新 `backup.lastLocalChangeAt` |
| `src/main/backup/sync-service.ts` | `BackupSyncService` 单例：定时器、互斥锁、LWW、保留份数 |
| `src/main/backup/remote/types.ts` | `BackupRemote` 接口 + 共用类型 |
| `src/main/backup/remote/webdav.ts` | WebDAV 实现 |
| `src/main/backup/remote/s3.ts` | S3 兼容（`s3-lite-client`） |
| `src/main/ipc/backup-handlers.ts` | 注册所有 `backup:*` 通道 |
| `src/renderer/src/components/settings/BackupSection.tsx` | 设置页主面板 |
| `src/renderer/src/components/settings/BackupPasswordDialog.tsx` | 输入口令对话框（导出/导入/历史恢复共用） |
| `src/renderer/src/components/settings/BackupRemoteDialog.tsx` | 配置 WebDAV / S3 后端 |
| `src/renderer/src/components/settings/BackupHistoryDialog.tsx` | 列出云端历史备份并恢复 |
| `src/renderer/src/stores/backupStore.ts` | renderer 状态 |

### Modify

| 路径 | 改动 |
|---|---|
| `src/shared/errors.ts` | 增加 `BACKUP_*` 错误码 |
| `src/shared/ipc-channels.ts` | 增加 `BACKUP_*` 通道常量 |
| `src/shared/types.ts` | 增加 `BackupSnapshot` / `BackupSummary` / `RemoteConfig` / `SyncStatus` / `SyncResult` / `RemoteBackupItem` / `BackupProgress` |
| `src/main/db/settings.ts` | 扩展 `SENSITIVE_KEYS` |
| `src/main/ipc/index.ts` | 注册 backup handlers + 接入 dirty-tracker |
| `src/main/index.ts` | 启动 BackupSyncService（应用启动时） |
| `src/preload/index.ts` | 暴露 `window.api.backup.*` |
| `src/renderer/src/components/settings/SettingsSidebar.tsx` | 增加 `'backup'` section |
| `src/renderer/src/components/settings/SettingsPage.tsx` | 路由 `'backup'` 到 `BackupSection` |
| `src/renderer/src/App.tsx` | 调用 `initBackupStore()` |
| `src/renderer/src/i18n/locales/en.json` | 新 i18n 键 |
| `src/renderer/src/i18n/locales/zh-CN.json` | 新 i18n 键 |
| `package.json` | 加 `s3-lite-client` 依赖 |

---

## 阶段总览

- **Phase 1（Tasks 1–3）— Foundation**：错误码 / IPC 通道 / 共享类型
- **Phase 2（Tasks 4–7）— Snapshot 核心**：crypto / codec / snapshot collect+apply
- **Phase 3（Tasks 8–13）— 本地导出导入端到端可用**
- **Phase 4（Tasks 14–17）— 远端后端**：WebDAV + S3
- **Phase 5（Tasks 18–21）— 同步引擎**：dirty-tracker + sync-service + sync UI
- **Phase 6（Tasks 22–23）— Polish**：i18n 全部补齐 + 冒烟

每个阶段末都有可手动验证的成果：
- Phase 3 末：导出/导入文件可用，云端 UI 还看不到
- Phase 4 末：可在 UI 配置远端并测试连通
- Phase 5 末：手动同步可用
- Phase 6 末：定时同步 + 完整 i18n 覆盖

---

# Phase 1 — Foundation

## Task 1：增加 backup 错误码与 i18n 文案

**Files:**
- Modify: `src/shared/errors.ts`
- Modify: `src/renderer/src/i18n/locales/en.json`
- Modify: `src/renderer/src/i18n/locales/zh-CN.json`

- [ ] **Step 1：在 `src/shared/errors.ts` 的 `ERROR_CODES` 中加入 backup 段**

在 `// fallback` 上面插入：

```ts
  // backup
  BACKUP_FILE_INVALID: 'errors.backup.fileInvalid',
  BACKUP_PASSWORD_WRONG: 'errors.backup.passwordWrong',
  BACKUP_SCHEMA_TOO_NEW: 'errors.backup.schemaTooNew',
  BACKUP_REMOTE_AUTH: 'errors.backup.remoteAuth',
  BACKUP_REMOTE_NOT_FOUND: 'errors.backup.remoteNotFound',
  BACKUP_REMOTE_NETWORK: 'errors.backup.remoteNetwork',
  BACKUP_REMOTE_FORBIDDEN: 'errors.backup.remoteForbidden',
  BACKUP_REMOTE_NOT_CONFIGURED: 'errors.backup.remoteNotConfigured',
  BACKUP_BUSY: 'errors.backup.busy',
  BACKUP_CANCELLED: 'errors.backup.cancelled',
  BACKUP_APPLY_FAILED: 'errors.backup.applyFailed',
```

- [ ] **Step 2：在两个 locale 文件的 `errors` 对象中加入对应文案**

`en.json`，找到 `"errors": {` 块，在末尾追加（保持 JSON 合法）：

```json
"backup": {
  "fileInvalid": "The selected file is not a valid backup file.",
  "passwordWrong": "Incorrect password, or the backup file has been tampered with.",
  "schemaTooNew": "This backup was created by a newer version of the app. Please upgrade and try again.",
  "remoteAuth": "Authentication with the remote storage failed. Please verify credentials.",
  "remoteNotFound": "Remote backup location not found.",
  "remoteNetwork": "Network error while contacting the remote storage.",
  "remoteForbidden": "The remote storage rejected the request (insufficient permissions).",
  "remoteNotConfigured": "No cloud backup destination is configured yet.",
  "busy": "A backup operation is already in progress.",
  "cancelled": "Operation was cancelled.",
  "applyFailed": "Failed to apply the backup; your existing data was not changed."
}
```

`zh-CN.json` 在 `errors` 对象末尾追加：

```json
"backup": {
  "fileInvalid": "选择的文件不是合法的备份文件。",
  "passwordWrong": "口令错误，或备份文件已被篡改。",
  "schemaTooNew": "该备份由更高版本的应用创建，请先升级再尝试。",
  "remoteAuth": "远端存储认证失败，请检查凭据。",
  "remoteNotFound": "未找到远端备份位置。",
  "remoteNetwork": "联系远端存储时发生网络错误。",
  "remoteForbidden": "远端存储拒绝了该请求（权限不足）。",
  "remoteNotConfigured": "尚未配置云端备份目的地。",
  "busy": "已有备份操作正在进行。",
  "cancelled": "操作已取消。",
  "applyFailed": "应用备份失败；现有数据未被修改。"
}
```

- [ ] **Step 3：typecheck**

```bash
npm run typecheck
```
Expected: PASS（仅修改的是字符串常量，应通过）

- [ ] **Step 4：format + commit**

```bash
npm run format
git add src/shared/errors.ts src/renderer/src/i18n/locales/en.json src/renderer/src/i18n/locales/zh-CN.json
git commit -m "feat(backup): add backup error codes and i18n strings"
```

---

## Task 2：增加 backup IPC 通道常量

**Files:**
- Modify: `src/shared/ipc-channels.ts`

- [ ] **Step 1：在 `IpcChannels` 对象末尾、`UPDATER_*` 之前插入 backup 段**

```ts
  // Backup
  BACKUP_EXPORT_TO_FILE: 'backup:export-to-file',
  BACKUP_IMPORT_FROM_FILE: 'backup:import-from-file',
  BACKUP_PEEK_FILE: 'backup:peek-file',
  BACKUP_GET_REMOTE_CONFIG: 'backup:get-remote-config',
  BACKUP_SET_REMOTE_CONFIG: 'backup:set-remote-config',
  BACKUP_CLEAR_REMOTE_CONFIG: 'backup:clear-remote-config',
  BACKUP_TEST_REMOTE: 'backup:test-remote',
  BACKUP_SYNC_NOW: 'backup:sync-now',
  BACKUP_SYNC_CANCEL: 'backup:sync-cancel',
  BACKUP_LIST_REMOTE: 'backup:list-remote',
  BACKUP_RESTORE_FROM_REMOTE: 'backup:restore-from-remote',
  BACKUP_GET_STATUS: 'backup:get-status',
  BACKUP_STATUS_CHANGED: 'backup:status-changed',
  BACKUP_PROGRESS: 'backup:progress',
```

- [ ] **Step 2：typecheck + format + commit**

```bash
npm run typecheck && npm run format
git add src/shared/ipc-channels.ts
git commit -m "feat(backup): add backup IPC channel constants"
```

---

## Task 3：增加共享类型定义

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 1：在 `src/shared/types.ts` 末尾追加**

```ts
// =============================================================================
// Backup & Cloud Sync
// =============================================================================

/** Plain (decrypted) snapshot of all "config-like" data. */
export interface BackupSnapshot {
  schemaVersion: 1
  exportedAt: string
  app: { version: string }
  /** All settings.* keys, with safeStorage-encrypted values already decrypted to plaintext. */
  settings: Record<string, string>
  /** Provider rows with `apiKey` already decrypted. */
  providers: Provider[]
  models: Model[]
  modelDefinitions: ModelDefinition[]
  modelGroups: ModelGroup[]
  assistants: Assistant[]
  phrases: Phrase[]
  quickActions: QuickAction[]
  selectionActions: SelectionAction[]
  avatars: BackupAvatar[]
}

export interface BackupAvatar {
  fileName: string
  mimeType: string
  /** base64 encoded file content. */
  data: string
}

export interface BackupSummary {
  providers: number
  models: number
  assistants: number
  phrases: number
  quickActions: number
  selectionActions: number
  modelDefinitions: number
  modelGroups: number
  settings: number
  avatars: number
}

/** Metadata embedded in the plaintext header of the .aibackup file. */
export interface BackupFileMeta {
  schemaVersion: 1
  appVersion: string
  createdAt: string
}

export type BackupImportMode = 'replace' | 'merge'

export type RemoteConfig =
  | {
      type: 'webdav'
      url: string
      username: string
      password: string
      subPath: string
    }
  | {
      type: 's3'
      endpoint: string
      region: string
      bucket: string
      accessKeyId: string
      secretAccessKey: string
      forcePathStyle: boolean
      prefix: string
    }

export interface SyncStatus {
  isSyncing: boolean
  lastLocalChangeAt: string | null
  lastSyncedAt: string | null
  lastRemoteSeenAt: string | null
  lastError: LocalizedError | null
  lastWarning: string | null
  hasRemoteConfigured: boolean
  autoSyncIntervalMinutes: number
}

export interface SyncResult {
  direction: 'upload' | 'download' | 'noop' | 'cancelled'
  /** ISO timestamp of the backup that became authoritative this round (when applicable). */
  createdAt?: string
}

export interface RemoteBackupItem {
  /** Object key relative to the remote root (e.g. `backups/2026-05-03T12-34-56-789Z.aibackup`). */
  key: string
  size: number
  /** Last-modified time reported by the remote. */
  lastModified: string
  /** `createdAt` parsed from the .aibackup plaintext header (or, if unavailable, derived from the key). */
  createdAt: string
  appVersion: string
}

export type BackupPhase =
  | 'collect'
  | 'encrypt'
  | 'upload'
  | 'download'
  | 'decrypt'
  | 'apply'
  | 'cleanup'

export interface BackupProgress {
  phase: BackupPhase
  /** 0–100; absent for indeterminate phases. */
  percent?: number
}
```

> **Note:** This file already imports `LocalizedError` from `./errors`. If not, the top of `types.ts` needs `import type { LocalizedError } from './errors'` — verify before continuing. The `Provider` / `Model` / `ModelDefinition` / `ModelGroup` / `Assistant` / `Phrase` / `QuickAction` / `SelectionAction` types must already exist in this file (they do — they are referenced widely in the project).

- [ ] **Step 2：typecheck**

```bash
npm run typecheck
```
Expected: PASS

- [ ] **Step 3：format + commit**

```bash
npm run format
git add src/shared/types.ts
git commit -m "feat(backup): add backup shared types"
```

---

# Phase 2 — Snapshot 核心

## Task 4：实现 `crypto.ts`（PBKDF2 + AES-256-GCM）

**Files:**
- Create: `src/main/backup/crypto.ts`

- [ ] **Step 1：创建 `src/main/backup/crypto.ts`**

```ts
import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'crypto'
import { AppError } from '../errors'
import { ERROR_CODES } from '@shared/errors'

const KDF_ITERATIONS = 200_000
const KDF_KEYLEN = 32 // 256-bit key for AES-256-GCM
const KDF_DIGEST = 'sha256'
const SALT_LEN = 16
const IV_LEN = 12
const TAG_LEN = 16

export interface EncryptedBundle {
  /** Base64-encoded ciphertext. */
  payload: string
  /** Base64-encoded GCM auth tag (16 bytes). */
  tag: string
  /** Base64-encoded PBKDF2 salt (16 bytes). */
  salt: string
  /** Base64-encoded GCM IV / nonce (12 bytes). */
  iv: string
  algo: 'AES-256-GCM'
  kdf: 'PBKDF2-SHA256'
  iterations: number
}

/** Derive a 32-byte key from the user's password. */
function deriveKey(password: string, salt: Buffer, iterations: number): Buffer {
  return pbkdf2Sync(password, salt, iterations, KDF_KEYLEN, KDF_DIGEST)
}

/** Encrypt a UTF-8 string with the given password. Generates fresh salt + IV per call. */
export function encryptString(plaintext: string, password: string): EncryptedBundle {
  const salt = randomBytes(SALT_LEN)
  const iv = randomBytes(IV_LEN)
  const key = deriveKey(password, salt, KDF_ITERATIONS)

  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return {
    payload: enc.toString('base64'),
    tag: tag.toString('base64'),
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    algo: 'AES-256-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations: KDF_ITERATIONS,
  }
}

/** Decrypt a bundle. Throws `AppError(BACKUP_PASSWORD_WRONG)` on auth-tag failure. */
export function decryptString(bundle: EncryptedBundle, password: string): string {
  if (bundle.algo !== 'AES-256-GCM' || bundle.kdf !== 'PBKDF2-SHA256') {
    throw new AppError(ERROR_CODES.BACKUP_FILE_INVALID, undefined, 'Unsupported encryption header')
  }
  const salt = Buffer.from(bundle.salt, 'base64')
  const iv = Buffer.from(bundle.iv, 'base64')
  const tag = Buffer.from(bundle.tag, 'base64')
  const enc = Buffer.from(bundle.payload, 'base64')
  if (salt.length !== SALT_LEN || iv.length !== IV_LEN || tag.length !== TAG_LEN) {
    throw new AppError(ERROR_CODES.BACKUP_FILE_INVALID, undefined, 'Encryption header has bad lengths')
  }
  const key = deriveKey(password, salt, bundle.iterations)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  try {
    const dec = Buffer.concat([decipher.update(enc), decipher.final()])
    return dec.toString('utf8')
  } catch {
    // Wrong password OR tampered ciphertext both land here — surface a single error.
    throw new AppError(ERROR_CODES.BACKUP_PASSWORD_WRONG)
  }
}
```

- [ ] **Step 2：typecheck + format + commit**

```bash
npm run typecheck && npm run format
git add src/main/backup/crypto.ts
git commit -m "feat(backup): add PBKDF2 + AES-256-GCM crypto module"
```

---

## Task 5：实现 `codec.ts`（`.aibackup` 文件格式）

**Files:**
- Create: `src/main/backup/codec.ts`

- [ ] **Step 1：创建 `src/main/backup/codec.ts`**

```ts
import { app } from 'electron'
import type { BackupFileMeta, BackupSnapshot } from '@shared/types'
import { ERROR_CODES } from '@shared/errors'
import { AppError } from '../errors'
import { decryptString, encryptString, type EncryptedBundle } from './crypto'

const MAGIC = 'AISTUDIO-BACKUP'
const SUPPORTED_SCHEMA = 1

interface BackupFile {
  magic: string
  schemaVersion: number
  appVersion: string
  createdAt: string
  encryption: {
    algo: 'AES-256-GCM'
    kdf: 'PBKDF2-SHA256'
    iterations: number
    salt: string
    iv: string
  }
  payload: string
  tag: string
}

/** Serialize a snapshot into the on-disk JSON form, encrypted with the user's password. */
export function encodeBackupFile(snapshot: BackupSnapshot, password: string): string {
  const bundle: EncryptedBundle = encryptString(JSON.stringify(snapshot), password)
  const file: BackupFile = {
    magic: MAGIC,
    schemaVersion: snapshot.schemaVersion,
    appVersion: snapshot.app.version,
    createdAt: snapshot.exportedAt,
    encryption: {
      algo: bundle.algo,
      kdf: bundle.kdf,
      iterations: bundle.iterations,
      salt: bundle.salt,
      iv: bundle.iv,
    },
    payload: bundle.payload,
    tag: bundle.tag,
  }
  return JSON.stringify(file, null, 2)
}

/** Read the plaintext header without decrypting the payload. */
export function peekBackupFile(rawJson: string): BackupFileMeta {
  const file = parseAndValidate(rawJson)
  return {
    schemaVersion: file.schemaVersion as 1,
    appVersion: file.appVersion,
    createdAt: file.createdAt,
  }
}

/** Decode + decrypt to a usable snapshot. */
export function decodeBackupFile(rawJson: string, password: string): BackupSnapshot {
  const file = parseAndValidate(rawJson)
  const bundle: EncryptedBundle = {
    payload: file.payload,
    tag: file.tag,
    salt: file.encryption.salt,
    iv: file.encryption.iv,
    algo: file.encryption.algo,
    kdf: file.encryption.kdf,
    iterations: file.encryption.iterations,
  }
  const json = decryptString(bundle, password)
  let snapshot: BackupSnapshot
  try {
    snapshot = JSON.parse(json) as BackupSnapshot
  } catch {
    throw new AppError(ERROR_CODES.BACKUP_FILE_INVALID, undefined, 'Snapshot JSON parse failed')
  }
  if (snapshot.schemaVersion !== SUPPORTED_SCHEMA) {
    throw new AppError(ERROR_CODES.BACKUP_SCHEMA_TOO_NEW)
  }
  return snapshot
}

/** Build the snapshot's plaintext envelope. */
export function buildSnapshotEnvelope<T extends Omit<BackupSnapshot, 'schemaVersion' | 'exportedAt' | 'app'>>(
  data: T,
): BackupSnapshot {
  return {
    schemaVersion: SUPPORTED_SCHEMA,
    exportedAt: new Date().toISOString(),
    app: { version: app.getVersion() },
    ...data,
  } as BackupSnapshot
}

function parseAndValidate(rawJson: string): BackupFile {
  let file: BackupFile
  try {
    file = JSON.parse(rawJson) as BackupFile
  } catch {
    throw new AppError(ERROR_CODES.BACKUP_FILE_INVALID, undefined, 'Outer JSON parse failed')
  }
  if (file.magic !== MAGIC) {
    throw new AppError(ERROR_CODES.BACKUP_FILE_INVALID, undefined, 'Bad magic')
  }
  if (typeof file.schemaVersion !== 'number') {
    throw new AppError(ERROR_CODES.BACKUP_FILE_INVALID, undefined, 'Missing schemaVersion')
  }
  if (file.schemaVersion > SUPPORTED_SCHEMA) {
    throw new AppError(ERROR_CODES.BACKUP_SCHEMA_TOO_NEW)
  }
  if (!file.encryption || !file.payload || !file.tag) {
    throw new AppError(ERROR_CODES.BACKUP_FILE_INVALID, undefined, 'Missing fields')
  }
  return file
}
```

- [ ] **Step 2：typecheck + format + commit**

```bash
npm run typecheck && npm run format
git add src/main/backup/codec.ts
git commit -m "feat(backup): add .aibackup file codec"
```

---

## Task 6：实现 `snapshot.ts` 的 `collectSnapshot()`（只读）

**Files:**
- Create: `src/main/backup/snapshot.ts`

- [ ] **Step 1：创建 `src/main/backup/snapshot.ts`，先只写读侧**

```ts
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { lookup as mimeLookup } from 'mime-types' // already a transitive dep; if not, fall back to inline map
import type {
  Assistant,
  BackupAvatar,
  BackupImportMode,
  BackupSnapshot,
  BackupSummary,
  Model,
  ModelDefinition,
  ModelGroup,
  Phrase,
  Provider,
  QuickAction,
  SelectionAction,
} from '@shared/types'
import {
  listProviders,
  listAssistants,
  listPhrases,
  listModelDefinitions,
  listModelGroups,
  listQuickActions,
  listSelectionActions,
} from '../db'
import { listModels } from '../db/models'
import { getAllSettings, setSettingsBatch } from '../db/settings'
import { getDb } from '../db/database'
import { getDataDir } from '../utils/paths'
import { buildSnapshotEnvelope } from './codec'

const AVATARS_SUBDIR = 'avatars'

/** Collect all "config-like" data into a plaintext snapshot ready for encryption. */
export function collectSnapshot(): BackupSnapshot {
  const settings = getAllSettings() // already decrypted
  const providers = listProviders() // apiKey already decrypted by db/providers.ts
  const models = listModelsAll(providers)
  const modelDefinitions = listModelDefinitions()
  const modelGroups = listModelGroups()
  const assistants = listAssistants()
  const phrases = listPhrases()
  const quickActions = listQuickActions()
  const selectionActions = listSelectionActions()
  const avatars = readAllAvatars()

  return buildSnapshotEnvelope({
    settings,
    providers,
    models,
    modelDefinitions,
    modelGroups,
    assistants,
    phrases,
    quickActions,
    selectionActions,
    avatars,
  })
}

function listModelsAll(providers: Provider[]): Model[] {
  const out: Model[] = []
  for (const p of providers) {
    out.push(...listModels(p.id))
  }
  return out
}

function readAllAvatars(): BackupAvatar[] {
  const dir = join(getDataDir(), AVATARS_SUBDIR)
  if (!existsSync(dir)) return []
  const out: BackupAvatar[] = []
  for (const fileName of readdirSync(dir)) {
    if (fileName.startsWith('.')) continue
    const full = join(dir, fileName)
    try {
      const data = readFileSync(full).toString('base64')
      const mimeType = (mimeLookup(fileName) || 'application/octet-stream') as string
      out.push({ fileName, mimeType, data })
    } catch {
      // skip unreadable file silently — backup is best-effort for avatars
    }
  }
  return out
}

// =============================================================================
// applySnapshot lives in Task 7
// =============================================================================
export function applySnapshot(_snapshot: BackupSnapshot, _mode: BackupImportMode): BackupSummary {
  throw new Error('applySnapshot not implemented yet — see Task 7')
}

// Local helpers used only by tests / Task 7 — exported so Task 7 can extend the file
export const _internal = {
  AVATARS_SUBDIR,
  getDb,
  setSettingsBatch,
  randomUUID,
  mkdirSync,
  rmSync,
  renameSync,
  writeFileSync,
  existsSync,
  Buffer,
  join,
  getDataDir,
}
```

> **Note on `mime-types`:** It's pulled in transitively via `electron`. If `npm run typecheck` complains about missing types, replace the import with an inline map:
> ```ts
> const MIME_BY_EXT: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' }
> function mimeLookup(name: string): string | undefined {
>   const ext = name.toLowerCase().split('.').pop()
>   return ext ? MIME_BY_EXT[ext] : undefined
> }
> ```
> Use the inline map if any typecheck error appears.

- [ ] **Step 2：确认 `src/main/db/index.ts` 已经 re-export 了 `listProviders / listAssistants / listPhrases / listModelDefinitions / listModelGroups / listQuickActions / listSelectionActions / listModels`。如果 `listModels` 没有 re-export，从 `db/models.ts` 直接 import 即可（Step 1 已经按此写法）。**

- [ ] **Step 3：typecheck**

```bash
npm run typecheck
```
Expected: PASS

- [ ] **Step 4：format + commit**

```bash
npm run format
git add src/main/backup/snapshot.ts
git commit -m "feat(backup): collectSnapshot() reads all config tables"
```

---

## Task 7：实现 `snapshot.ts` 的 `applySnapshot()`（事务回写）

**Files:**
- Modify: `src/main/backup/snapshot.ts`

- [ ] **Step 1：替换 Task 6 中的占位 `applySnapshot` 与 `_internal` 部分为完整实现**

把 `// applySnapshot lives in Task 7` 一行起到文件末尾的所有内容替换为：

```ts
/**
 * Apply a snapshot to the local database. Wrapped in a single SQLite transaction
 * — if any step throws, the DB is rolled back and avatars are reverted.
 *
 * `replace` mode (default): clear each config table, then insert from snapshot.
 * `merge`   mode: upsert by id (snapshot wins for collisions; local-only rows kept).
 */
export function applySnapshot(snapshot: BackupSnapshot, mode: BackupImportMode): BackupSummary {
  const db = getDb()
  const dataDir = getDataDir()
  const finalAvatarsDir = join(dataDir, AVATARS_SUBDIR)
  const tmpAvatarsDir = join(dataDir, AVATARS_SUBDIR + '.import-' + randomUUID())

  // 1. Stage avatars to a temp dir BEFORE touching the DB.
  if (snapshot.avatars.length > 0) {
    mkdirSync(tmpAvatarsDir, { recursive: true })
    for (const av of snapshot.avatars) {
      writeFileSync(join(tmpAvatarsDir, av.fileName), Buffer.from(av.data, 'base64'))
    }
  }

  let summary: BackupSummary | null = null
  try {
    db.transaction(() => {
      summary = applyTablesAndSettings(snapshot, mode)
    })()
  } catch (e) {
    // Roll back avatar staging and rethrow.
    if (existsSync(tmpAvatarsDir)) {
      try {
        rmSync(tmpAvatarsDir, { recursive: true, force: true })
      } catch {
        /* best-effort */
      }
    }
    throw e
  }

  // 2. DB committed. Now atomically swap avatars dir.
  if (snapshot.avatars.length > 0) {
    if (mode === 'replace' && existsSync(finalAvatarsDir)) {
      const trashDir = finalAvatarsDir + '.trash-' + randomUUID()
      renameSync(finalAvatarsDir, trashDir)
      try {
        renameSync(tmpAvatarsDir, finalAvatarsDir)
        rmSync(trashDir, { recursive: true, force: true })
      } catch (e) {
        // Try to restore old avatars dir if rename of new dir fails.
        try {
          renameSync(trashDir, finalAvatarsDir)
        } catch {
          /* best-effort */
        }
        throw e
      }
    } else {
      // merge: copy each tmp file into finalAvatarsDir, overwriting same names.
      mkdirSync(finalAvatarsDir, { recursive: true })
      for (const av of snapshot.avatars) {
        writeFileSync(join(finalAvatarsDir, av.fileName), Buffer.from(av.data, 'base64'))
      }
      rmSync(tmpAvatarsDir, { recursive: true, force: true })
    }
  }

  return summary!
}

function applyTablesAndSettings(snapshot: BackupSnapshot, mode: BackupImportMode): BackupSummary {
  const db = getDb()

  if (mode === 'replace') {
    // Order matters: child tables before parent (FK ON CASCADE handles it for
    // models→providers, but we still drop in this order for clarity).
    db.exec(`
      DELETE FROM models;
      DELETE FROM providers;
      DELETE FROM assistants;
      DELETE FROM phrases;
      DELETE FROM model_definitions;
      DELETE FROM model_groups;
      DELETE FROM quick_actions;
      DELETE FROM selection_actions;
      DELETE FROM settings;
    `)
  }

  // ---------- providers (apiKey will be re-encrypted via db helpers below) ----------
  const upsertProvider = db.prepare(`
    INSERT INTO providers (id, type, name, api_key, base_url, enabled, is_default, sort_order)
    VALUES (@id, @type, @name, @api_key, @base_url, @enabled, @is_default, @sort_order)
    ON CONFLICT(id) DO UPDATE SET
      type = excluded.type,
      name = excluded.name,
      api_key = excluded.api_key,
      base_url = excluded.base_url,
      enabled = excluded.enabled,
      is_default = excluded.is_default,
      sort_order = excluded.sort_order,
      updated_at = datetime('now')
  `)
  for (const p of snapshot.providers) {
    upsertProvider.run({
      id: p.id,
      type: p.type,
      name: p.name,
      // Re-encrypt with local safeStorage. Import via the helper from settings.ts so
      // we get the same `enc:` envelope used elsewhere.
      api_key: p.apiKey ? encryptApiKey(p.apiKey) : '',
      base_url: p.baseUrl,
      enabled: p.enabled ? 1 : 0,
      is_default: p.isDefault ? 1 : 0,
      sort_order: p.sortOrder,
    })
  }

  // ---------- models ----------
  const upsertModel = db.prepare(`
    INSERT INTO models (id, provider_id, name, group_name, capabilities, enabled, sort_order)
    VALUES (@id, @provider_id, @name, @group_name, @capabilities, @enabled, @sort_order)
    ON CONFLICT(id) DO UPDATE SET
      provider_id = excluded.provider_id,
      name = excluded.name,
      group_name = excluded.group_name,
      capabilities = excluded.capabilities,
      enabled = excluded.enabled,
      sort_order = excluded.sort_order
  `)
  for (const m of snapshot.models) {
    upsertModel.run({
      id: m.id,
      provider_id: m.providerId,
      name: m.name,
      group_name: m.groupName ?? '',
      capabilities: JSON.stringify(m.capabilities ?? []),
      enabled: m.enabled ? 1 : 0,
      sort_order: m.sortOrder,
    })
  }

  // ---------- assistants ----------
  const upsertAssistant = db.prepare(`
    INSERT INTO assistants (id, name, icon, description, system_prompt, provider_id, model,
      temperature, max_completion_tokens, top_p, context_count, prompt_suggestions,
      is_default, group_name, sort_order)
    VALUES (@id, @name, @icon, @description, @system_prompt, @provider_id, @model,
      @temperature, @max_completion_tokens, @top_p, @context_count, @prompt_suggestions,
      @is_default, @group_name, @sort_order)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      icon = excluded.icon,
      description = excluded.description,
      system_prompt = excluded.system_prompt,
      provider_id = excluded.provider_id,
      model = excluded.model,
      temperature = excluded.temperature,
      max_completion_tokens = excluded.max_completion_tokens,
      top_p = excluded.top_p,
      context_count = excluded.context_count,
      prompt_suggestions = excluded.prompt_suggestions,
      is_default = excluded.is_default,
      group_name = excluded.group_name,
      sort_order = excluded.sort_order,
      updated_at = datetime('now')
  `)
  for (const a of snapshot.assistants) {
    upsertAssistant.run({
      id: a.id,
      name: a.name,
      icon: a.icon ?? '',
      description: a.description ?? '',
      system_prompt: a.systemPrompt ?? '',
      provider_id: a.providerId ?? null,
      model: a.model ?? '',
      temperature: a.temperature ?? '',
      max_completion_tokens: a.maxCompletionTokens ?? '',
      top_p: a.topP ?? '',
      context_count: a.contextCount ?? '10',
      prompt_suggestions: JSON.stringify(a.promptSuggestions ?? []),
      is_default: a.isDefault ? 1 : 0,
      group_name: a.groupName ?? '',
      sort_order: a.sortOrder,
    })
  }

  // ---------- phrases ----------
  const upsertPhrase = db.prepare(`
    INSERT INTO phrases (id, title, content, sort_order)
    VALUES (@id, @title, @content, @sort_order)
    ON CONFLICT(id) DO UPDATE SET title = excluded.title, content = excluded.content, sort_order = excluded.sort_order
  `)
  for (const p of snapshot.phrases) {
    upsertPhrase.run({ id: p.id, title: p.title ?? '', content: p.content, sort_order: p.sortOrder })
  }

  // ---------- model_definitions ----------
  const upsertDef = db.prepare(`
    INSERT INTO model_definitions (id, name, group_name, capabilities, provider_types)
    VALUES (@id, @name, @group_name, @capabilities, @provider_types)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      group_name = excluded.group_name,
      capabilities = excluded.capabilities,
      provider_types = excluded.provider_types,
      updated_at = datetime('now')
  `)
  for (const d of snapshot.modelDefinitions) {
    upsertDef.run({
      id: d.id,
      name: d.name,
      group_name: d.groupName ?? '',
      capabilities: JSON.stringify(d.capabilities ?? []),
      provider_types: JSON.stringify(d.providerTypes ?? []),
    })
  }

  // ---------- model_groups ----------
  const upsertGroup = db.prepare(`
    INSERT INTO model_groups (id, pattern, display_name, sort_order)
    VALUES (@id, @pattern, @display_name, @sort_order)
    ON CONFLICT(id) DO UPDATE SET
      pattern = excluded.pattern,
      display_name = excluded.display_name,
      sort_order = excluded.sort_order,
      updated_at = datetime('now')
  `)
  for (const g of snapshot.modelGroups) {
    upsertGroup.run({
      id: g.id,
      pattern: g.pattern,
      display_name: g.displayName,
      sort_order: g.sortOrder,
    })
  }

  // ---------- quick_actions ----------
  const upsertQA = db.prepare(`
    INSERT INTO quick_actions (id, name, description, system_prompt, icon, is_builtin, sort_order, enabled)
    VALUES (@id, @name, @description, @system_prompt, @icon, @is_builtin, @sort_order, @enabled)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      system_prompt = excluded.system_prompt,
      icon = excluded.icon,
      is_builtin = excluded.is_builtin,
      sort_order = excluded.sort_order,
      enabled = excluded.enabled,
      updated_at = datetime('now')
  `)
  for (const q of snapshot.quickActions) {
    upsertQA.run({
      id: q.id,
      name: q.name,
      description: q.description ?? '',
      system_prompt: q.systemPrompt ?? '',
      icon: q.icon ?? 'Sparkles',
      is_builtin: q.isBuiltin ? 1 : 0,
      sort_order: q.sortOrder,
      enabled: q.enabled ? 1 : 0,
    })
  }

  // ---------- selection_actions ----------
  const upsertSA = db.prepare(`
    INSERT INTO selection_actions (id, name, description, system_prompt, icon, is_builtin, sort_order, enabled)
    VALUES (@id, @name, @description, @system_prompt, @icon, @is_builtin, @sort_order, @enabled)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      system_prompt = excluded.system_prompt,
      icon = excluded.icon,
      is_builtin = excluded.is_builtin,
      sort_order = excluded.sort_order,
      enabled = excluded.enabled,
      updated_at = datetime('now')
  `)
  for (const s of snapshot.selectionActions) {
    upsertSA.run({
      id: s.id,
      name: s.name,
      description: s.description ?? '',
      system_prompt: s.systemPrompt ?? '',
      icon: s.icon ?? 'Sparkles',
      is_builtin: s.isBuiltin ? 1 : 0,
      sort_order: s.sortOrder,
      enabled: s.enabled ? 1 : 0,
    })
  }

  // ---------- settings (upsert; encrypt on the way in via setSettingsBatch) ----------
  setSettingsBatch(snapshot.settings)

  return {
    providers: snapshot.providers.length,
    models: snapshot.models.length,
    assistants: snapshot.assistants.length,
    phrases: snapshot.phrases.length,
    quickActions: snapshot.quickActions.length,
    selectionActions: snapshot.selectionActions.length,
    modelDefinitions: snapshot.modelDefinitions.length,
    modelGroups: snapshot.modelGroups.length,
    settings: Object.keys(snapshot.settings).length,
    avatars: snapshot.avatars.length,
  }
}

// Re-encrypt API key for local safeStorage. Imported here to avoid a cycle:
// we call settings.ts's `encrypt` directly so the format matches what
// providers.ts already does on insert/update.
import { encrypt as encryptSetting } from '../db/settings'
function encryptApiKey(plain: string): string {
  return encryptSetting(plain)
}
```

> **Note on `setSettingsBatch`:** The existing helper in `src/main/db/settings.ts` already routes through `SENSITIVE_KEYS` to encrypt values like `api.apiKey`. After Phase 5 we extend `SENSITIVE_KEYS` with `backup.remote.password` etc. — for now, providers' `api_key` (a column, not a `settings` row) is handled inline above via `encryptApiKey`.

- [ ] **Step 2：typecheck**

```bash
npm run typecheck
```
Expected: PASS. If errors complain about missing properties on `Provider` / `Assistant` etc., open `src/shared/types.ts` and confirm field names match (e.g. `apiKey` vs `api_key`, `providerId` vs `provider_id`). Use the existing types as ground truth.

- [ ] **Step 3：format + commit**

```bash
npm run format
git add src/main/backup/snapshot.ts
git commit -m "feat(backup): applySnapshot() with transaction + atomic avatars swap"
```

---

# Phase 3 — 本地导出导入端到端

## Task 8：`backup/index.ts` 门面（exportToFile / importFromFile / peekFile）

**Files:**
- Create: `src/main/backup/index.ts`

- [ ] **Step 1：创建 `src/main/backup/index.ts`**

```ts
import { dialog, BrowserWindow } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import type {
  BackupFileMeta,
  BackupImportMode,
  BackupProgress,
  BackupSummary,
} from '@shared/types'
import { ERROR_CODES } from '@shared/errors'
import { AppError } from '../errors'
import { IpcChannels } from '@shared/ipc-channels'
import { decodeBackupFile, encodeBackupFile, peekBackupFile } from './codec'
import { applySnapshot, collectSnapshot } from './snapshot'

export type ProgressCallback = (p: BackupProgress) => void

function broadcast(progress: BackupProgress): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IpcChannels.BACKUP_PROGRESS, progress)
  }
}

export interface ExportResult {
  filePath: string
}

/** Show a save dialog, then write the encrypted backup file. */
export async function exportToFile(password: string): Promise<ExportResult> {
  if (!password || password.length < 1) {
    throw new AppError(ERROR_CODES.BACKUP_FILE_INVALID, undefined, 'Empty password')
  }
  broadcast({ phase: 'collect' })
  const snapshot = collectSnapshot()
  broadcast({ phase: 'encrypt' })
  const json = encodeBackupFile(snapshot, password)

  const defaultName = `aistudio-backup-${snapshot.exportedAt.replace(/[:.]/g, '-')}.aibackup`
  const result = await dialog.showSaveDialog({
    title: 'Export AI Studio backup',
    defaultPath: defaultName,
    filters: [{ name: 'AI Studio Backup', extensions: ['aibackup'] }],
  })
  if (result.canceled || !result.filePath) {
    throw new AppError(ERROR_CODES.BACKUP_CANCELLED)
  }
  let outPath = result.filePath
  if (!outPath.toLowerCase().endsWith('.aibackup')) outPath = outPath + '.aibackup'
  await writeFile(outPath, json, 'utf8')
  return { filePath: outPath }
}

/** Read the plaintext header without decrypting. */
export async function peekFile(filePath: string): Promise<BackupFileMeta> {
  const raw = await readFile(filePath, 'utf8')
  return peekBackupFile(raw)
}

/** Decrypt + apply a backup file to the local DB. */
export async function importFromFile(
  filePath: string,
  password: string,
  mode: BackupImportMode,
): Promise<BackupSummary> {
  broadcast({ phase: 'decrypt' })
  const raw = await readFile(filePath, 'utf8')
  const snapshot = decodeBackupFile(raw, password)
  broadcast({ phase: 'apply' })
  try {
    return applySnapshot(snapshot, mode)
  } catch (e) {
    if (e instanceof AppError) throw e
    throw new AppError(
      ERROR_CODES.BACKUP_APPLY_FAILED,
      undefined,
      e instanceof Error ? e.message : String(e),
    )
  }
}

/** Helper for the cloud sync flow (Phase 5) — write a backup snapshot to a given path. */
export async function writeSnapshotToFile(
  filePath: string,
  password: string,
): Promise<{ filePath: string }> {
  const snapshot = collectSnapshot()
  const json = encodeBackupFile(snapshot, password)
  await writeFile(filePath, json, 'utf8')
  return { filePath }
}

/** Helper for the cloud sync flow — produce the encrypted bytes without touching disk. */
export function encodeSnapshotBytes(password: string): { bytes: Uint8Array; createdAt: string } {
  const snapshot = collectSnapshot()
  const json = encodeBackupFile(snapshot, password)
  return { bytes: new TextEncoder().encode(json), createdAt: snapshot.exportedAt }
}

/** Helper for the cloud sync flow — apply a snapshot from in-memory bytes. */
export function applyEncryptedBytes(
  bytes: Uint8Array,
  password: string,
  mode: BackupImportMode,
): BackupSummary {
  const json = new TextDecoder().decode(bytes)
  const snapshot = decodeBackupFile(json, password)
  return applySnapshot(snapshot, mode)
}

// Re-export so tests / future code can reach internals through one entry.
export { collectSnapshot, applySnapshot } from './snapshot'
export { peekBackupFile } from './codec'
export { join as _joinForTest }
```

- [ ] **Step 2：typecheck + format + commit**

```bash
npm run typecheck && npm run format
git add src/main/backup/index.ts
git commit -m "feat(backup): export/import facade"
```

---

## Task 9：注册 backup IPC handlers（仅本地导出导入部分）

**Files:**
- Create: `src/main/ipc/backup-handlers.ts`
- Modify: `src/main/ipc/index.ts`

- [ ] **Step 1：创建 `src/main/ipc/backup-handlers.ts`**

```ts
import { ipcMain, dialog } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type { BackupFileMeta, BackupImportMode, BackupSummary, IpcResult } from '@shared/types'
import { toLocalizedError } from '../errors'
import { exportToFile, importFromFile, peekFile } from '../backup'

export function registerBackupHandlers(): void {
  ipcMain.handle(
    IpcChannels.BACKUP_EXPORT_TO_FILE,
    async (_, payload: { password: string }): Promise<IpcResult<{ filePath: string }>> => {
      try {
        const data = await exportToFile(payload.password)
        return { success: true, data }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(
    IpcChannels.BACKUP_PEEK_FILE,
    async (_, payload: { filePath: string }): Promise<IpcResult<BackupFileMeta>> => {
      try {
        const data = await peekFile(payload.filePath)
        return { success: true, data }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(
    IpcChannels.BACKUP_IMPORT_FROM_FILE,
    async (
      _,
      payload: { filePath?: string; password: string; mode: BackupImportMode },
    ): Promise<IpcResult<{ applied: BackupSummary }>> => {
      try {
        let filePath = payload.filePath
        if (!filePath) {
          const result = await dialog.showOpenDialog({
            title: 'Import AI Studio backup',
            filters: [{ name: 'AI Studio Backup', extensions: ['aibackup'] }],
            properties: ['openFile'],
          })
          if (result.canceled || result.filePaths.length === 0) {
            return { success: false, error: { code: 'errors.backup.cancelled' } }
          }
          filePath = result.filePaths[0]
        }
        const applied = await importFromFile(filePath, payload.password, payload.mode)
        return { success: true, data: { applied } }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )
}
```

- [ ] **Step 2：在 `src/main/ipc/index.ts` 中注册**

在 import 区追加：
```ts
import { registerBackupHandlers } from './backup-handlers'
```

在 `registerAllIpcHandlers()` 函数末尾追加：
```ts
  registerBackupHandlers()
```

- [ ] **Step 3：typecheck + format + commit**

```bash
npm run typecheck && npm run format
git add src/main/ipc/backup-handlers.ts src/main/ipc/index.ts
git commit -m "feat(backup): register local export/import IPC handlers"
```

---

## Task 10：preload 暴露 `window.api.backup.*`（本地部分）

**Files:**
- Modify: `src/preload/index.ts`

- [ ] **Step 1：在 preload 顶部 import 处追加**

```ts
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
```
（如果文件已经从 `@shared/types` 大块 import，把这些键合并进去而不是新增 import 语句）

- [ ] **Step 2：在 `const api = { ... }` 内合适位置（其他 domain 之间）插入 backup 段**

```ts
  // Backup
  backup: {
    exportToFile: (password: string): Promise<IpcResult<{ filePath: string }>> =>
      ipcRenderer.invoke(IpcChannels.BACKUP_EXPORT_TO_FILE, { password }),
    peekFile: (filePath: string): Promise<IpcResult<BackupFileMeta>> =>
      ipcRenderer.invoke(IpcChannels.BACKUP_PEEK_FILE, { filePath }),
    importFromFile: (
      payload: { filePath?: string; password: string; mode: BackupImportMode },
    ): Promise<IpcResult<{ applied: BackupSummary }>> =>
      ipcRenderer.invoke(IpcChannels.BACKUP_IMPORT_FROM_FILE, payload),
    getRemoteConfig: (): Promise<IpcResult<RemoteConfig | null>> =>
      ipcRenderer.invoke(IpcChannels.BACKUP_GET_REMOTE_CONFIG),
    setRemoteConfig: (cfg: RemoteConfig): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IpcChannels.BACKUP_SET_REMOTE_CONFIG, cfg),
    clearRemoteConfig: (): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IpcChannels.BACKUP_CLEAR_REMOTE_CONFIG),
    testRemote: (cfg: RemoteConfig): Promise<IpcResult<{ ok: boolean; latency?: number }>> =>
      ipcRenderer.invoke(IpcChannels.BACKUP_TEST_REMOTE, cfg),
    syncNow: (): Promise<IpcResult<SyncResult>> =>
      ipcRenderer.invoke(IpcChannels.BACKUP_SYNC_NOW),
    syncCancel: (): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IpcChannels.BACKUP_SYNC_CANCEL),
    listRemote: (): Promise<IpcResult<RemoteBackupItem[]>> =>
      ipcRenderer.invoke(IpcChannels.BACKUP_LIST_REMOTE),
    restoreFromRemote: (
      payload: { key: string; password: string; mode: BackupImportMode },
    ): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IpcChannels.BACKUP_RESTORE_FROM_REMOTE, payload),
    getStatus: (): Promise<IpcResult<SyncStatus>> =>
      ipcRenderer.invoke(IpcChannels.BACKUP_GET_STATUS),
    onStatusChanged: (cb: (status: SyncStatus) => void): (() => void) => {
      const fn = (_: unknown, status: SyncStatus): void => cb(status)
      ipcRenderer.on(IpcChannels.BACKUP_STATUS_CHANGED, fn)
      return () => ipcRenderer.removeListener(IpcChannels.BACKUP_STATUS_CHANGED, fn)
    },
    onProgress: (cb: (p: BackupProgress) => void): (() => void) => {
      const fn = (_: unknown, p: BackupProgress): void => cb(p)
      ipcRenderer.on(IpcChannels.BACKUP_PROGRESS, fn)
      return () => ipcRenderer.removeListener(IpcChannels.BACKUP_PROGRESS, fn)
    },
  },
```

- [ ] **Step 3：preload 注册（如果 preload 用 d.ts 或 typed exposure helper）**

按现有 preload 文件末尾 `contextBridge.exposeInMainWorld('api', api)` 一句话不变，无需修改。

- [ ] **Step 4：typecheck**（注意 preload 走 `tsconfig.node.json`）

```bash
npm run typecheck
```
Expected: PASS

- [ ] **Step 5：format + commit**

```bash
npm run format
git add src/preload/index.ts
git commit -m "feat(backup): expose window.api.backup.* surface"
```

> **Note:** Renderer code accesses `window.api.backup.*`. There is no separate `.d.ts` in this project — `window.api` is typed via the `api` const itself. The renderer treats it as `any` unless project has `globals.d.ts`. Search for `declare global` in `src/renderer` if a typed surface is required; otherwise renderer call sites use `// @ts-expect-error` only when truly necessary (none expected here because we re-import `IpcResult<...>` from `@shared/types` on each call).

---

## Task 11：renderer `backupStore.ts`（本地部分）

**Files:**
- Create: `src/renderer/src/stores/backupStore.ts`

- [ ] **Step 1：创建 store**

```ts
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

  setRemoteConfig: (cfg: RemoteConfig) => Promise<void | { error: LocalizedError }>
  clearRemoteConfig: () => Promise<void>
  testRemote: (cfg: RemoteConfig) => Promise<{ ok: boolean; latency?: number; error?: LocalizedError }>

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
    set({ isLoadingStatus: false, status: r.success ? r.data ?? null : null })
  },

  loadRemoteConfig: async () => {
    const r = await window.api.backup.getRemoteConfig()
    set({ remoteConfig: r.success ? r.data ?? null : null })
  },

  exportToFile: async (password) => {
    const r = await window.api.backup.exportToFile(password)
    if (r.success && r.data) return r.data
    return { error: r.error ?? { code: 'errors.internal' } }
  },

  peekFile: async (filePath) => {
    const r = await window.api.backup.peekFile(filePath)
    if (r.success && r.data) return r.data
    return { error: r.error ?? { code: 'errors.internal' } }
  },

  importFromFile: async (filePath, password, mode) => {
    const r = await window.api.backup.importFromFile({ filePath, password, mode })
    if (r.success && r.data) {
      // Refresh local stores in App.tsx via a settings-changed event isn't enough;
      // callers should soft-reload. For simplicity we reload status here.
      get().loadStatus()
      return r.data.applied
    }
    return { error: r.error ?? { code: 'errors.internal' } }
  },

  setRemoteConfig: async (cfg) => {
    const r = await window.api.backup.setRemoteConfig(cfg)
    if (r.success) {
      get().loadRemoteConfig()
      get().loadStatus()
      return
    }
    return { error: r.error ?? { code: 'errors.internal' } }
  },

  clearRemoteConfig: async () => {
    await window.api.backup.clearRemoteConfig()
    set({ remoteConfig: null })
    get().loadStatus()
  },

  testRemote: async (cfg) => {
    const r = await window.api.backup.testRemote(cfg)
    if (r.success && r.data) return r.data
    return { ok: false, error: r.error ?? { code: 'errors.internal' } }
  },

  syncNow: async () => {
    const r = await window.api.backup.syncNow()
    if (r.success && r.data) {
      get().loadStatus()
      return r.data
    }
    return { error: r.error ?? { code: 'errors.internal' } }
  },

  cancelSync: async () => {
    await window.api.backup.syncCancel()
  },

  listRemote: async () => {
    const r = await window.api.backup.listRemote()
    if (r.success && r.data) return r.data
    return { error: r.error ?? { code: 'errors.internal' } }
  },

  restoreFromRemote: async (key, password, mode) => {
    const r = await window.api.backup.restoreFromRemote({ key, password, mode })
    if (r.success) {
      get().loadStatus()
      return
    }
    return { error: r.error ?? { code: 'errors.internal' } }
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
```

- [ ] **Step 2：typecheck**（renderer 用 `tsconfig.web.json`）

```bash
npm run typecheck:web
```
Expected: PASS — 如果 `window.api.backup` 报红，说明 preload 类型未传到 renderer。临时解决方案：在 store 顶部 `// eslint-disable-next-line @typescript-eslint/no-explicit-any` 然后 `const api = (window as any).api`。但优先检查项目内是否已有 `globals.d.ts` 把 `window.api` 类型化。

```bash
# 找一下：
```
```bash
grep -rn "window.api" src/renderer/src/env.d.ts
```

如果没有 typed `window.api`，就在 `src/renderer/src/env.d.ts` 末尾追加：

```ts
declare global {
  interface Window {
    api: typeof import('../../../preload')['api']
  }
}
export {}
```
注意路径基于实际 `tsconfig.web.json` 的 `baseUrl`；如果 import 解析失败，更稳妥做法是在 preload 里 `export type Api = typeof api`，然后在 `env.d.ts` 里 `import type { Api } from '../../../preload/index'`。

- [ ] **Step 3：format + commit**

```bash
npm run format
git add src/renderer/src/stores/backupStore.ts src/renderer/src/env.d.ts
git commit -m "feat(backup): renderer backup store"
```

---

## Task 12：UI — `BackupPasswordDialog` 通用口令对话框

**Files:**
- Create: `src/renderer/src/components/settings/BackupPasswordDialog.tsx`

- [ ] **Step 1：创建对话框**

```tsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'

export interface BackupPasswordDialogProps {
  open: boolean
  /** 'export' requires confirm; 'import' / 'restore' only ask once. */
  mode: 'export' | 'import' | 'restore'
  /** Optional preview info shown above the input (e.g. peeked file metadata). */
  preview?: React.ReactNode
  onCancel: () => void
  onSubmit: (password: string) => Promise<void> | void
  /** External error to show under the input (e.g. wrong password). */
  errorText?: string | null
}

export function BackupPasswordDialog({
  open,
  mode,
  preview,
  onCancel,
  onSubmit,
  errorText,
}: BackupPasswordDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [localErr, setLocalErr] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setPw('')
      setPw2('')
      setLocalErr(null)
      setBusy(false)
    }
  }, [open])

  const titleKey = mode === 'export' ? 'settings.backup.password.exportTitle'
    : mode === 'import' ? 'settings.backup.password.importTitle'
    : 'settings.backup.password.restoreTitle'
  const descKey = mode === 'export' ? 'settings.backup.password.exportDesc'
    : 'settings.backup.password.importDesc'
  const submitKey = mode === 'export' ? 'common.confirm' : 'settings.backup.password.unlock'

  const submit = async (): Promise<void> => {
    if (!pw) {
      setLocalErr(t('settings.backup.password.required'))
      return
    }
    if (mode === 'export' && pw !== pw2) {
      setLocalErr(t('settings.backup.password.mismatch'))
      return
    }
    setBusy(true)
    setLocalErr(null)
    try {
      await onSubmit(pw)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(titleKey)}</DialogTitle>
          <DialogDescription>{t(descKey)}</DialogDescription>
        </DialogHeader>

        {preview && <div className="text-sm rounded-md bg-muted p-3">{preview}</div>}

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="bp-pw">{t('settings.backup.password.label')}</Label>
            <Input
              id="bp-pw"
              type="password"
              autoFocus
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>
          {mode === 'export' && (
            <div className="grid gap-1.5">
              <Label htmlFor="bp-pw2">{t('settings.backup.password.confirmLabel')}</Label>
              <Input
                id="bp-pw2"
                type="password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
              />
            </div>
          )}
          {(localErr || errorText) && (
            <p className="text-xs text-destructive">{localErr ?? errorText}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button disabled={busy} onClick={submit}>
            {busy ? t('common.saving') : t(submitKey)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2：format + commit**

```bash
npm run format
git add src/renderer/src/components/settings/BackupPasswordDialog.tsx
git commit -m "feat(backup): password input dialog"
```

---

## Task 13：UI — `BackupSection` 本地部分 + 接入 Sidebar/Page + i18n

**Files:**
- Create: `src/renderer/src/components/settings/BackupSection.tsx`
- Modify: `src/renderer/src/components/settings/SettingsSidebar.tsx`
- Modify: `src/renderer/src/components/settings/SettingsPage.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/i18n/locales/en.json`
- Modify: `src/renderer/src/i18n/locales/zh-CN.json`

- [ ] **Step 1：创建 `BackupSection.tsx`，先只做本地导出导入。云端区块预留 placeholder，由 Phase 5 填**

```tsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import { Label } from '@renderer/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@renderer/components/ui/radio-group'
import { useBackupStore } from '@renderer/stores/backupStore'
import { useLocalizedError } from '@renderer/hooks/useLocalizedError'
import { toast } from 'sonner'
import { BackupPasswordDialog } from './BackupPasswordDialog'
import type { BackupImportMode, BackupFileMeta } from '@shared/types'

export function BackupSection(): React.JSX.Element {
  const { t } = useTranslation()
  const localizedError = useLocalizedError()
  const exportToFile = useBackupStore((s) => s.exportToFile)
  const importFromFile = useBackupStore((s) => s.importFromFile)
  const peekFile = useBackupStore((s) => s.peekFile)

  const [importMode, setImportMode] = useState<BackupImportMode>('replace')
  const [exportOpen, setExportOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [pendingFilePath, setPendingFilePath] = useState<string | undefined>(undefined)
  const [peekMeta, setPeekMeta] = useState<BackupFileMeta | null>(null)
  const [pwError, setPwError] = useState<string | null>(null)

  useEffect(() => {
    setPwError(null)
  }, [exportOpen, importOpen])

  const handleExport = async (): Promise<void> => setExportOpen(true)

  const handleExportSubmit = async (password: string): Promise<void> => {
    const r = await exportToFile(password)
    if ('error' in r) {
      // Cancel from the save dialog comes through as BACKUP_CANCELLED — ignore quietly.
      if (r.error.code !== 'errors.backup.cancelled') {
        toast.error(localizedError(r.error))
      }
      setExportOpen(false)
      return
    }
    toast.success(t('settings.backup.exportSuccess', { path: r.filePath }))
    setExportOpen(false)
  }

  const handleImport = async (): Promise<void> => {
    // 1. Ask the user to pick a file using the project's existing open-dialog IPC.
    const fileResult = await window.api.openFileDialog({
      filters: [{ name: 'AI Studio Backup', extensions: ['aibackup'] }],
      properties: ['openFile'],
    })
    if (!fileResult.success || !fileResult.data || fileResult.data.length === 0) return
    const filePath = fileResult.data[0]
    // 2. Peek the plaintext header so we can show created-at + app-version
    //    in the password dialog before the user types.
    const meta = await peekFile(filePath)
    if ('error' in meta) {
      toast.error(localizedError(meta.error))
      return
    }
    setPeekMeta(meta)
    setPendingFilePath(filePath)
    setImportOpen(true)
  }

  const handleImportSubmit = async (password: string): Promise<void> => {
    if (!pendingFilePath) return
    const r = await importFromFile(pendingFilePath, password, importMode)
    if ('error' in r) {
      if (r.error.code === 'errors.backup.passwordWrong') {
        setPwError(t('errors.backup.passwordWrong'))
        return
      }
      toast.error(localizedError(r.error))
      setImportOpen(false)
      return
    }
    toast.success(
      t('settings.backup.importSuccess', {
        providers: r.providers,
        assistants: r.assistants,
        settings: r.settings,
      }),
    )
    setImportOpen(false)
    setPendingFilePath(undefined)
    setPeekMeta(null)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-xl border bg-card/50 p-5">
        <h2 className="text-base font-semibold">{t('settings.backup.title')}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t('settings.backup.description')}</p>
      </div>

      {/* Local backup card */}
      <div className="rounded-xl border bg-card/50 p-5 space-y-4">
        <h3 className="text-sm font-semibold">{t('settings.backup.localTitle')}</h3>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleExport}>{t('settings.backup.exportButton')}</Button>
          <Button variant="outline" onClick={handleImport}>
            {t('settings.backup.importButton')}
          </Button>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">{t('settings.backup.importMode')}</Label>
          <RadioGroup
            className="mt-2 flex gap-4"
            value={importMode}
            onValueChange={(v) => setImportMode(v as BackupImportMode)}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="replace" id="bm-replace" />
              <Label htmlFor="bm-replace" className="text-sm font-normal">
                {t('settings.backup.modeReplace')}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="merge" id="bm-merge" />
              <Label htmlFor="bm-merge" className="text-sm font-normal">
                {t('settings.backup.modeMerge')}
              </Label>
            </div>
          </RadioGroup>
        </div>

        <p className="text-xs text-muted-foreground">{t('settings.backup.passwordHint')}</p>
      </div>

      {/* Cloud sync card — filled in Phase 5 */}
      <div className="rounded-xl border bg-card/50 p-5">
        <h3 className="text-sm font-semibold">{t('settings.backup.cloudTitle')}</h3>
        <p className="text-xs text-muted-foreground mt-1">{t('settings.backup.cloudComingSoon')}</p>
      </div>

      <BackupPasswordDialog
        open={exportOpen}
        mode="export"
        onCancel={() => setExportOpen(false)}
        onSubmit={handleExportSubmit}
      />
      <BackupPasswordDialog
        open={importOpen}
        mode="import"
        onCancel={() => {
          setImportOpen(false)
          setPendingFilePath(undefined)
          setPeekMeta(null)
        }}
        onSubmit={handleImportSubmit}
        errorText={pwError}
        preview={
          peekMeta ? (
            <div className="grid gap-1">
              <div>
                <span className="text-muted-foreground">{t('settings.backup.peek.created')}: </span>
                {new Date(peekMeta.createdAt).toLocaleString()}
              </div>
              <div>
                <span className="text-muted-foreground">{t('settings.backup.peek.appVersion')}: </span>
                {peekMeta.appVersion}
              </div>
            </div>
          ) : undefined
        }
      />
    </div>
  )
}
```

> **Note:** `useLocalizedError` is the project's existing hook (see `src/renderer/src/hooks/useLocalizedError.ts`). It returns a function that takes a `LocalizedError` and returns the translated string. If the hook lives at a different path, follow the existing settings sections' usage pattern.
>
> The "stage 1 hack" in `handleImport` was illustrative. The clean path uses `window.api.openFileDialog`, which already exists in this project (see `FILE_OPEN_DIALOG` channel). Verify its signature in `preload/index.ts` and adjust the call site to match (some code uses `openFileDialog({ filters, properties })`, others `showOpenDialog`).

- [ ] **Step 2：在 `SettingsSidebar.tsx` 中引入 `'backup'` section**

在 `SettingsSection` 类型 union 末尾追加 `| 'backup'`。

在 import 处加入图标：
```ts
import { ShieldCheck } from 'lucide-react'  // 也可改用 HardDriveDownload
```

修改 `sectionGroups` —— 把 `'data'` 所在的那一组改成：
```ts
[
  { id: 'general', labelKey: 'settings.sections.general', icon: Settings2 },
  { id: 'network', labelKey: 'settings.sections.network', icon: Globe },
  { id: 'display', labelKey: 'settings.sections.display', icon: Monitor },
  { id: 'data', labelKey: 'settings.sections.data', icon: Database },
  { id: 'backup', labelKey: 'settings.sections.backup', icon: ShieldCheck },
],
```

- [ ] **Step 3：在 `SettingsPage.tsx` 中接线**

import 区追加：
```ts
import { BackupSection } from './BackupSection'
```

在 ScrollArea 内的渲染分支末尾追加：
```tsx
              {activeSection === 'backup' && <BackupSection />}
```

- [ ] **Step 4：在 `App.tsx` 中初始化 backup store**

找到现有的其他 `init*Store()` 调用聚集处（应该在 `App` 组件的 `useEffect` 里），追加：
```ts
import { initBackupStore } from '@renderer/stores/backupStore'
// ...
initBackupStore()
```

如果项目没有"集中初始化"的 useEffect，参考 `phraseStore` 的 `initPhraseStore` 调用位置；通常在 `App.tsx` 顶层 `useEffect(() => { initXxxStore(); ... }, [])` 里。

- [ ] **Step 5：在两个 locale 文件中添加 i18n 键**

在 `en.json` 的 `settings` 块里：

`settings.sections` 加 `"backup": "Backup"`。

在 `settings` 顶层加：
```json
"backup": {
  "title": "Backup",
  "description": "Export and restore your AI Studio configuration. Chat history is not backed up.",
  "localTitle": "Local backup",
  "exportButton": "Export to file…",
  "importButton": "Import from file…",
  "importMode": "Import mode",
  "modeReplace": "Replace (clear existing, then load)",
  "modeMerge": "Merge (backup wins on collision)",
  "passwordHint": "Backup files are always encrypted with your password.",
  "cloudTitle": "Cloud sync",
  "cloudComingSoon": "Configurable in a later release.",
  "exportSuccess": "Backup written to {{path}}",
  "importSuccess": "Imported {{providers}} providers, {{assistants}} assistants, {{settings}} settings.",
  "peek": {
    "created": "Created",
    "appVersion": "App version"
  },
  "password": {
    "exportTitle": "Set backup password",
    "exportDesc": "This password will encrypt the backup file. Don't lose it — there's no recovery.",
    "importTitle": "Unlock backup",
    "importDesc": "Enter the password used when this backup was created.",
    "restoreTitle": "Restore from cloud backup",
    "label": "Password",
    "confirmLabel": "Confirm password",
    "required": "Password is required.",
    "mismatch": "Passwords do not match.",
    "unlock": "Unlock"
  }
}
```

在 `zh-CN.json` 中加镜像版本（中文翻译）：

```json
"backup": {
  "title": "数据备份",
  "description": "导出与恢复 AI Studio 的配置；聊天记录不会被备份。",
  "localTitle": "本地备份",
  "exportButton": "导出到文件…",
  "importButton": "从文件导入…",
  "importMode": "导入方式",
  "modeReplace": "替换（先清空再导入）",
  "modeMerge": "合并（同 ID 以备份为准）",
  "passwordHint": "备份文件始终使用你设置的口令进行加密。",
  "cloudTitle": "云端同步",
  "cloudComingSoon": "稍后版本中开放。",
  "exportSuccess": "备份已保存到 {{path}}",
  "importSuccess": "已导入 {{providers}} 个供应商、{{assistants}} 个助手、{{settings}} 项设置。",
  "peek": {
    "created": "创建时间",
    "appVersion": "应用版本"
  },
  "password": {
    "exportTitle": "设置备份口令",
    "exportDesc": "此口令将用于加密备份文件，请妥善保管，丢失将无法恢复。",
    "importTitle": "解锁备份",
    "importDesc": "请输入创建此备份时使用的口令。",
    "restoreTitle": "从云端备份恢复",
    "label": "口令",
    "confirmLabel": "确认口令",
    "required": "请填写口令。",
    "mismatch": "两次口令不一致。",
    "unlock": "解锁"
  }
}
```

`zh-CN.json` 的 `settings.sections` 块里加 `"backup": "数据备份"`。

- [ ] **Step 6：typecheck + format**

```bash
npm run typecheck && npm run format
```

- [ ] **Step 7：手动冒烟**

```bash
npm run dev
```

验证：
1. 打开 Settings，左侧能看到"数据备份"
2. 点"导出到文件…"，输入两次口令一致 → 选择保存位置 → 文件成功生成
3. 用任何文本编辑器打开导出的 `.aibackup`，能看到 `"magic": "AISTUDIO-BACKUP"` 等明文头
4. 点"从文件导入…"，选择刚才的文件 → 显示元信息 → 输入正确口令 → 成功；输入错误口令 → 红色提示"口令错误"
5. typecheck 也要 PASS

- [ ] **Step 8：commit**

```bash
git add \
  src/renderer/src/components/settings/BackupSection.tsx \
  src/renderer/src/components/settings/SettingsSidebar.tsx \
  src/renderer/src/components/settings/SettingsPage.tsx \
  src/renderer/src/App.tsx \
  src/renderer/src/i18n/locales/en.json \
  src/renderer/src/i18n/locales/zh-CN.json
git commit -m "feat(backup): local export/import end-to-end UI"
```

**Phase 3 milestone：本地导出/导入端到端可用。**

---

# Phase 4 — 远端后端

## Task 14：`BackupRemote` 接口与共用类型

**Files:**
- Create: `src/main/backup/remote/types.ts`

- [ ] **Step 1：创建文件**

```ts
import { ERROR_CODES } from '@shared/errors'
import { AppError } from '../../errors'

export interface RemoteObject {
  /** Object key relative to the backup root (e.g. `backups/xxx.aibackup`). */
  key: string
  size: number
  /** ISO timestamp of the object's last modification on the remote. */
  lastModified: string
}

export interface BackupRemote {
  put(path: string, bytes: Uint8Array): Promise<void>
  get(path: string): Promise<Uint8Array>
  list(prefix: string): Promise<RemoteObject[]>
  delete(path: string): Promise<void>
  /** Returns null if the object doesn't exist (so callers can branch on "first sync"). */
  headLastModified(path: string): Promise<string | null>
}

/** Map a transport-layer error to a stable AppError code. */
export function classifyRemoteError(status: number | null, raw: unknown): never {
  if (status === 401 || status === 403) {
    if (status === 401) throw new AppError(ERROR_CODES.BACKUP_REMOTE_AUTH)
    throw new AppError(ERROR_CODES.BACKUP_REMOTE_FORBIDDEN)
  }
  if (status === 404) throw new AppError(ERROR_CODES.BACKUP_REMOTE_NOT_FOUND)
  if (raw instanceof Error && /timeout|ECONNREFUSED|ENOTFOUND|EAI_AGAIN/i.test(raw.message)) {
    throw new AppError(ERROR_CODES.BACKUP_REMOTE_NETWORK, undefined, raw.message)
  }
  throw new AppError(
    ERROR_CODES.BACKUP_REMOTE_NETWORK,
    undefined,
    raw instanceof Error ? raw.message : String(raw),
  )
}

/** True iff the error indicates "object does not exist". */
export function isNotFound(e: unknown): boolean {
  return e instanceof AppError && e.code === ERROR_CODES.BACKUP_REMOTE_NOT_FOUND
}
```

- [ ] **Step 2：commit**

```bash
npm run typecheck && npm run format
git add src/main/backup/remote/types.ts
git commit -m "feat(backup): BackupRemote interface"
```

---

## Task 15：WebDAV 实现

**Files:**
- Create: `src/main/backup/remote/webdav.ts`

- [ ] **Step 1：创建文件**

```ts
import type { BackupRemote, RemoteObject } from './types'
import { classifyRemoteError, isNotFound } from './types'
import { ERROR_CODES } from '@shared/errors'
import { AppError } from '../../errors'

export interface WebDAVOptions {
  url: string
  username: string
  password: string
  /** Subpath under the WebDAV root, e.g. `/aistudio-backup`. */
  subPath: string
}

export class WebDAVRemote implements BackupRemote {
  constructor(private opts: WebDAVOptions) {}

  private base(): string {
    const root = this.opts.url.replace(/\/+$/, '')
    const sub = this.opts.subPath.replace(/^\/+|\/+$/g, '')
    return sub ? `${root}/${sub}` : root
  }

  private url(path: string): string {
    const trimmed = path.replace(/^\/+/, '')
    return `${this.base()}/${trimmed}`
  }

  private auth(): string {
    return 'Basic ' + Buffer.from(`${this.opts.username}:${this.opts.password}`).toString('base64')
  }

  async put(path: string, bytes: Uint8Array): Promise<void> {
    // Ensure parent directories exist (MKCOL is idempotent — 405 means "already there").
    await this.ensureDirsFor(path)
    const res = await fetch(this.url(path), {
      method: 'PUT',
      headers: { Authorization: this.auth(), 'Content-Type': 'application/octet-stream' },
      body: bytes,
    }).catch((e) => classifyRemoteError(null, e))
    if (!res.ok) classifyRemoteError(res.status, new Error(`PUT ${path} → ${res.status}`))
  }

  async get(path: string): Promise<Uint8Array> {
    const res = await fetch(this.url(path), {
      method: 'GET',
      headers: { Authorization: this.auth() },
    }).catch((e) => classifyRemoteError(null, e))
    if (res.status === 404) throw new AppError(ERROR_CODES.BACKUP_REMOTE_NOT_FOUND)
    if (!res.ok) classifyRemoteError(res.status, new Error(`GET ${path} → ${res.status}`))
    const buf = await res.arrayBuffer()
    return new Uint8Array(buf)
  }

  async delete(path: string): Promise<void> {
    const res = await fetch(this.url(path), {
      method: 'DELETE',
      headers: { Authorization: this.auth() },
    }).catch((e) => classifyRemoteError(null, e))
    if (res.status === 404) return
    if (!res.ok) classifyRemoteError(res.status, new Error(`DELETE ${path} → ${res.status}`))
  }

  async headLastModified(path: string): Promise<string | null> {
    try {
      const res = await fetch(this.url(path), {
        method: 'HEAD',
        headers: { Authorization: this.auth() },
      })
      if (res.status === 404) return null
      if (!res.ok) classifyRemoteError(res.status, new Error(`HEAD ${path} → ${res.status}`))
      const lm = res.headers.get('last-modified')
      return lm ? new Date(lm).toISOString() : null
    } catch (e) {
      if (isNotFound(e)) return null
      throw e
    }
  }

  async list(prefix: string): Promise<RemoteObject[]> {
    const url = this.url(prefix.endsWith('/') ? prefix : prefix + '/')
    const body = `<?xml version="1.0"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:getcontentlength/>
    <d:getlastmodified/>
    <d:resourcetype/>
  </d:prop>
</d:propfind>`
    const res = await fetch(url, {
      method: 'PROPFIND',
      headers: {
        Authorization: this.auth(),
        Depth: '1',
        'Content-Type': 'application/xml; charset=utf-8',
      },
      body,
    }).catch((e) => classifyRemoteError(null, e))
    if (res.status === 404) return []
    if (!res.ok) classifyRemoteError(res.status, new Error(`PROPFIND ${prefix} → ${res.status}`))
    const xml = await res.text()
    return parsePropfind(xml, this.base(), prefix)
  }

  private async ensureDirsFor(path: string): Promise<void> {
    const parts = path.split('/').filter(Boolean)
    if (parts.length <= 1) return
    let cumulative = ''
    for (let i = 0; i < parts.length - 1; i++) {
      cumulative += (i === 0 ? '' : '/') + parts[i]
      const res = await fetch(this.url(cumulative + '/'), {
        method: 'MKCOL',
        headers: { Authorization: this.auth() },
      }).catch((e) => classifyRemoteError(null, e))
      // 201 created, 405 method-not-allowed (already exists), 301 redirect — all fine
      if (![200, 201, 301, 405].includes(res.status)) {
        // Some servers return 409 if a parent collection is missing; let it bubble.
        if (res.status >= 400 && res.status !== 409) {
          classifyRemoteError(res.status, new Error(`MKCOL ${cumulative} → ${res.status}`))
        }
      }
    }
  }
}

/** Minimal PROPFIND XML parser (no external dep). */
function parsePropfind(xml: string, baseUrl: string, prefix: string): RemoteObject[] {
  const out: RemoteObject[] = []
  // Crude regex-based parser. Each <d:response> has <d:href>, <d:getcontentlength>,
  // <d:getlastmodified>, <d:resourcetype>. We skip collections.
  const responseRegex = /<(?:\w+:)?response\b[^>]*>([\s\S]*?)<\/(?:\w+:)?response>/g
  const innerRegex = (tag: string): RegExp =>
    new RegExp(`<(?:\\w+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, 'i')
  const baseUrlNoTrail = baseUrl.replace(/\/+$/, '')
  for (const m of xml.matchAll(responseRegex)) {
    const block = m[1]
    const isCollection = /<(?:\w+:)?collection\b/.test(block)
    if (isCollection) continue
    const href = innerRegex('href').exec(block)?.[1]?.trim()
    const lengthStr = innerRegex('getcontentlength').exec(block)?.[1]?.trim() ?? '0'
    const lastModStr = innerRegex('getlastmodified').exec(block)?.[1]?.trim() ?? ''
    if (!href) continue
    // href might be absolute or relative; resolve against baseUrl.
    let absoluteHref: string
    try {
      absoluteHref = new URL(href, baseUrlNoTrail + '/').toString()
    } catch {
      continue
    }
    let key = absoluteHref.startsWith(baseUrlNoTrail)
      ? absoluteHref.slice(baseUrlNoTrail.length).replace(/^\/+/, '')
      : href.replace(/^\/+/, '')
    // Drop the prefix we asked about so callers see paths like `backups/x.aibackup`.
    const normalizedPrefix = prefix.replace(/^\/+|\/+$/g, '')
    if (normalizedPrefix && key.startsWith(normalizedPrefix + '/')) {
      // keep as-is (already includes the prefix)
    }
    out.push({
      key,
      size: parseInt(lengthStr, 10) || 0,
      lastModified: lastModStr ? new Date(lastModStr).toISOString() : '',
    })
  }
  return out
}
```

> **Note on PROPFIND parsing:** Real-world WebDAV servers return slightly different XML namespace prefixes (`d:`, `D:`, none). The regex parser above is intentionally tolerant. If a target server breaks parsing, swap to `fast-xml-parser` (already used by `node-screenshots` transitively — verify with `npm ls fast-xml-parser`); if missing, swallow it as a future task and fall back to regex.

- [ ] **Step 2：commit**

```bash
npm run typecheck && npm run format
git add src/main/backup/remote/webdav.ts
git commit -m "feat(backup): WebDAV remote implementation"
```

---

## Task 16：安装 `s3-lite-client` + S3 实现

**Files:**
- Modify: `package.json`
- Create: `src/main/backup/remote/s3.ts`

- [ ] **Step 1：安装依赖**

```bash
npm install s3-lite-client
```

确认 `package.json` 的 `dependencies` 现在包含 `"s3-lite-client": "^x.y.z"`。

- [ ] **Step 2：创建 `src/main/backup/remote/s3.ts`**

```ts
import { S3Client } from 's3-lite-client'
import type { BackupRemote, RemoteObject } from './types'
import { classifyRemoteError } from './types'
import { ERROR_CODES } from '@shared/errors'
import { AppError } from '../../errors'

export interface S3Options {
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  /** Path-style addressing — true for MinIO/B2/most non-AWS S3 compatibles. */
  forcePathStyle: boolean
  /** Object key prefix inside the bucket (e.g. `aistudio-backup/`). */
  prefix: string
}

export class S3Remote implements BackupRemote {
  private client: S3Client

  constructor(private opts: S3Options) {
    // s3-lite-client wants endPoint host (no scheme). Parse the URL.
    const u = new URL(opts.endpoint)
    this.client = new S3Client({
      endPoint: u.host,
      port: u.port ? parseInt(u.port, 10) : undefined,
      useSSL: u.protocol === 'https:',
      region: opts.region || 'auto',
      bucket: opts.bucket,
      accessKey: opts.accessKeyId,
      secretKey: opts.secretAccessKey,
      pathStyle: opts.forcePathStyle,
    })
  }

  private key(path: string): string {
    const p = (this.opts.prefix || '').replace(/^\/+|\/+$/g, '')
    const k = path.replace(/^\/+/, '')
    return p ? `${p}/${k}` : k
  }

  async put(path: string, bytes: Uint8Array): Promise<void> {
    try {
      await this.client.putObject(this.key(path), bytes)
    } catch (e) {
      mapAndThrow(e)
    }
  }

  async get(path: string): Promise<Uint8Array> {
    try {
      const res = await this.client.getObject(this.key(path))
      const buf = await res.arrayBuffer()
      return new Uint8Array(buf)
    } catch (e) {
      mapAndThrow(e)
    }
  }

  async delete(path: string): Promise<void> {
    try {
      await this.client.deleteObject(this.key(path))
    } catch (e) {
      // Treat 404 as success.
      if (statusOf(e) === 404) return
      mapAndThrow(e)
    }
  }

  async headLastModified(path: string): Promise<string | null> {
    try {
      const stat = await this.client.statObject(this.key(path))
      return stat.lastModified ? stat.lastModified.toISOString() : null
    } catch (e) {
      if (statusOf(e) === 404) return null
      mapAndThrow(e)
    }
  }

  async list(prefix: string): Promise<RemoteObject[]> {
    const fullPrefix = this.key(prefix)
    const out: RemoteObject[] = []
    try {
      for await (const obj of this.client.listObjects({ prefix: fullPrefix })) {
        if (!obj.key) continue
        // Strip the bucket-level prefix so callers see relative paths.
        const stripped = this.opts.prefix
          ? obj.key.replace(new RegExp('^' + escapeRegExp(this.opts.prefix.replace(/^\/+|\/+$/g, '')) + '/'), '')
          : obj.key
        out.push({
          key: stripped,
          size: obj.size ?? 0,
          lastModified: obj.lastModified ? obj.lastModified.toISOString() : '',
        })
      }
    } catch (e) {
      mapAndThrow(e)
    }
    return out
  }
}

function statusOf(e: unknown): number | null {
  if (typeof e === 'object' && e !== null && 'statusCode' in e) {
    const sc = (e as { statusCode?: unknown }).statusCode
    if (typeof sc === 'number') return sc
  }
  return null
}

function mapAndThrow(e: unknown): never {
  const status = statusOf(e)
  if (status === 404) throw new AppError(ERROR_CODES.BACKUP_REMOTE_NOT_FOUND)
  if (status === 403) throw new AppError(ERROR_CODES.BACKUP_REMOTE_FORBIDDEN)
  if (status === 401) throw new AppError(ERROR_CODES.BACKUP_REMOTE_AUTH)
  if (e instanceof Error && /Signature|InvalidAccessKeyId/i.test(e.message)) {
    throw new AppError(ERROR_CODES.BACKUP_REMOTE_AUTH, undefined, e.message)
  }
  classifyRemoteError(status, e)
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
```

> **Note on `s3-lite-client` API surface:** This file uses the names from the package's documented v1 API (`putObject`, `getObject`, `statObject`, `listObjects`, `deleteObject`). If `npm run typecheck` reports differing names after install, peek at `node_modules/s3-lite-client/dist/index.d.ts` and adjust call sites accordingly — the conceptual flow is unchanged. The constructor option for path-style is sometimes `pathStyle` and sometimes `useSSL` — confirm against the typedefs after install.

- [ ] **Step 3：typecheck + commit**

```bash
npm run typecheck && npm run format
git add package.json package-lock.json src/main/backup/remote/s3.ts
git commit -m "feat(backup): S3-compatible remote via s3-lite-client"
```

---

## Task 17：远端配置存储 + IPC + UI 对话框

**Files:**
- Modify: `src/main/db/settings.ts` (extend SENSITIVE_KEYS)
- Modify: `src/main/ipc/backup-handlers.ts`
- Modify: `src/main/backup/index.ts` (helpers for remote-config persistence + factory)
- Create: `src/renderer/src/components/settings/BackupRemoteDialog.tsx`
- Modify: `src/renderer/src/components/settings/BackupSection.tsx` (replace placeholder cloud card)
- Modify locale files: add new strings

- [ ] **Step 1：在 `src/main/db/settings.ts` 扩展 `SENSITIVE_KEYS`**

把
```ts
const SENSITIVE_KEYS = new Set(['api.apiKey'])
```
改为：
```ts
const SENSITIVE_KEYS = new Set([
  'api.apiKey',
  'backup.remote.password',
  'backup.remote.secretAccessKey',
  'backup.syncPassphrase',
])
```

- [ ] **Step 2：在 `src/main/backup/index.ts` 末尾追加远端配置持久化与 factory**

```ts
import type { RemoteConfig } from '@shared/types'
import { getSetting, setSetting } from '../db/settings'
import { WebDAVRemote } from './remote/webdav'
import { S3Remote } from './remote/s3'
import type { BackupRemote } from './remote/types'
import { getDb } from '../db/database'

export function loadRemoteConfig(): RemoteConfig | null {
  const type = getSetting('backup.remote.type')
  if (type !== 'webdav' && type !== 's3') return null
  const cfgRaw = getSetting('backup.remote.config')
  if (!cfgRaw) return null
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(cfgRaw)
  } catch {
    return null
  }
  if (type === 'webdav') {
    return {
      type: 'webdav',
      url: String(parsed.url ?? ''),
      username: String(parsed.username ?? ''),
      password: getSetting('backup.remote.password') ?? '',
      subPath: String(parsed.subPath ?? ''),
    }
  }
  return {
    type: 's3',
    endpoint: String(parsed.endpoint ?? ''),
    region: String(parsed.region ?? 'auto'),
    bucket: String(parsed.bucket ?? ''),
    accessKeyId: String(parsed.accessKeyId ?? ''),
    secretAccessKey: getSetting('backup.remote.secretAccessKey') ?? '',
    forcePathStyle: parsed.forcePathStyle === true,
    prefix: String(parsed.prefix ?? ''),
  }
}

export function saveRemoteConfig(cfg: RemoteConfig): void {
  if (cfg.type === 'webdav') {
    setSetting('backup.remote.type', 'webdav')
    setSetting(
      'backup.remote.config',
      JSON.stringify({ url: cfg.url, username: cfg.username, subPath: cfg.subPath }),
    )
    setSetting('backup.remote.password', cfg.password)
  } else {
    setSetting('backup.remote.type', 's3')
    setSetting(
      'backup.remote.config',
      JSON.stringify({
        endpoint: cfg.endpoint,
        region: cfg.region,
        bucket: cfg.bucket,
        accessKeyId: cfg.accessKeyId,
        forcePathStyle: cfg.forcePathStyle,
        prefix: cfg.prefix,
      }),
    )
    setSetting('backup.remote.secretAccessKey', cfg.secretAccessKey)
  }
}

export function clearRemoteConfig(): void {
  const db = getDb()
  db.prepare(`DELETE FROM settings WHERE key LIKE 'backup.remote.%'`).run()
}

export function buildRemote(cfg: RemoteConfig): BackupRemote {
  if (cfg.type === 'webdav') {
    return new WebDAVRemote({
      url: cfg.url,
      username: cfg.username,
      password: cfg.password,
      subPath: cfg.subPath,
    })
  }
  return new S3Remote({
    endpoint: cfg.endpoint,
    region: cfg.region,
    bucket: cfg.bucket,
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    forcePathStyle: cfg.forcePathStyle,
    prefix: cfg.prefix,
  })
}

/** Probe the remote with a tiny PUT/GET/DELETE round-trip. */
export async function testRemote(cfg: RemoteConfig): Promise<{ ok: boolean; latency: number }> {
  const remote = buildRemote(cfg)
  const probeKey = `aistudio-probe-${Date.now()}.txt`
  const start = Date.now()
  await remote.put(probeKey, new TextEncoder().encode('aistudio-probe'))
  await remote.get(probeKey)
  await remote.delete(probeKey).catch(() => {
    /* best-effort */
  })
  return { ok: true, latency: Date.now() - start }
}
```

- [ ] **Step 3：在 `src/main/ipc/backup-handlers.ts` 中追加 remote-config / test-remote handlers**

文件顶部 import 区追加：
```ts
import { clearRemoteConfig, loadRemoteConfig, saveRemoteConfig, testRemote } from '../backup'
import type { RemoteConfig } from '@shared/types'
```

`registerBackupHandlers()` 函数内追加：
```ts
  ipcMain.handle(
    IpcChannels.BACKUP_GET_REMOTE_CONFIG,
    (): IpcResult<RemoteConfig | null> => {
      try {
        return { success: true, data: loadRemoteConfig() }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(
    IpcChannels.BACKUP_SET_REMOTE_CONFIG,
    (_, cfg: RemoteConfig): IpcResult<void> => {
      try {
        saveRemoteConfig(cfg)
        return { success: true }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(IpcChannels.BACKUP_CLEAR_REMOTE_CONFIG, (): IpcResult<void> => {
    try {
      clearRemoteConfig()
      return { success: true }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(
    IpcChannels.BACKUP_TEST_REMOTE,
    async (_, cfg: RemoteConfig): Promise<IpcResult<{ ok: boolean; latency?: number }>> => {
      try {
        const data = await testRemote(cfg)
        return { success: true, data }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )
```

- [ ] **Step 4：创建 `BackupRemoteDialog.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Switch } from '@renderer/components/ui/switch'
import { Button } from '@renderer/components/ui/button'
import { useBackupStore } from '@renderer/stores/backupStore'
import { useLocalizedError } from '@renderer/hooks/useLocalizedError'
import type { RemoteConfig } from '@shared/types'

export interface BackupRemoteDialogProps {
  open: boolean
  initial: RemoteConfig | null
  onCancel: () => void
  onSaved: () => void
}

export function BackupRemoteDialog({
  open,
  initial,
  onCancel,
  onSaved,
}: BackupRemoteDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const localizedError = useLocalizedError()
  const setRemoteConfig = useBackupStore((s) => s.setRemoteConfig)
  const testRemote = useBackupStore((s) => s.testRemote)

  const [tab, setTab] = useState<'webdav' | 's3'>(initial?.type ?? 'webdav')
  const [testing, setTesting] = useState(false)
  const [testMsg, setTestMsg] = useState<string | null>(null)
  const [testOk, setTestOk] = useState(false)

  // WebDAV form state
  const [wUrl, setWUrl] = useState(initial?.type === 'webdav' ? initial.url : '')
  const [wUser, setWUser] = useState(initial?.type === 'webdav' ? initial.username : '')
  const [wPw, setWPw] = useState(initial?.type === 'webdav' ? initial.password : '')
  const [wSub, setWSub] = useState(initial?.type === 'webdav' ? initial.subPath : 'aistudio-backup')

  // S3 form state
  const [sEndpoint, setSEndpoint] = useState(initial?.type === 's3' ? initial.endpoint : '')
  const [sRegion, setSRegion] = useState(initial?.type === 's3' ? initial.region : 'auto')
  const [sBucket, setSBucket] = useState(initial?.type === 's3' ? initial.bucket : '')
  const [sAk, setSAk] = useState(initial?.type === 's3' ? initial.accessKeyId : '')
  const [sSk, setSSk] = useState(initial?.type === 's3' ? initial.secretAccessKey : '')
  const [sPath, setSPath] = useState(initial?.type === 's3' ? initial.forcePathStyle : true)
  const [sPrefix, setSPrefix] = useState(initial?.type === 's3' ? initial.prefix : 'aistudio-backup')

  useEffect(() => {
    if (open) {
      setTab(initial?.type ?? 'webdav')
      setTesting(false)
      setTestMsg(null)
      setTestOk(false)
    }
  }, [open, initial])

  const buildCfg = (): RemoteConfig =>
    tab === 'webdav'
      ? { type: 'webdav', url: wUrl, username: wUser, password: wPw, subPath: wSub }
      : {
          type: 's3',
          endpoint: sEndpoint,
          region: sRegion,
          bucket: sBucket,
          accessKeyId: sAk,
          secretAccessKey: sSk,
          forcePathStyle: sPath,
          prefix: sPrefix,
        }

  const doTest = async (): Promise<void> => {
    setTesting(true)
    setTestMsg(null)
    setTestOk(false)
    const r = await testRemote(buildCfg())
    setTesting(false)
    if (r.ok) {
      setTestOk(true)
      setTestMsg(t('settings.backup.remote.testOk', { latency: r.latency ?? 0 }))
    } else if (r.error) {
      setTestMsg(localizedError(r.error))
    }
  }

  const doSave = async (): Promise<void> => {
    if (!testOk) return
    const r = await setRemoteConfig(buildCfg())
    if (r && 'error' in r) {
      setTestMsg(localizedError(r.error))
      return
    }
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('settings.backup.remote.dialogTitle')}</DialogTitle>
          <DialogDescription>{t('settings.backup.remote.dialogDesc')}</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'webdav' | 's3')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="webdav">WebDAV</TabsTrigger>
            <TabsTrigger value="s3">S3 / S3-Compatible</TabsTrigger>
          </TabsList>
          <TabsContent value="webdav" className="grid gap-3 pt-3">
            <Field label={t('settings.backup.remote.webdav.url')} placeholder="https://dav.jianguoyun.com/dav/" value={wUrl} onChange={setWUrl} />
            <Field label={t('settings.backup.remote.webdav.username')} value={wUser} onChange={setWUser} />
            <Field label={t('settings.backup.remote.webdav.password')} type="password" value={wPw} onChange={setWPw} />
            <Field label={t('settings.backup.remote.webdav.subPath')} placeholder="aistudio-backup" value={wSub} onChange={setWSub} />
          </TabsContent>
          <TabsContent value="s3" className="grid gap-3 pt-3">
            <Field label={t('settings.backup.remote.s3.endpoint')} placeholder="https://<account>.r2.cloudflarestorage.com" value={sEndpoint} onChange={setSEndpoint} />
            <Field label={t('settings.backup.remote.s3.region')} value={sRegion} onChange={setSRegion} />
            <Field label={t('settings.backup.remote.s3.bucket')} value={sBucket} onChange={setSBucket} />
            <Field label={t('settings.backup.remote.s3.accessKeyId')} value={sAk} onChange={setSAk} />
            <Field label={t('settings.backup.remote.s3.secretAccessKey')} type="password" value={sSk} onChange={setSSk} />
            <Field label={t('settings.backup.remote.s3.prefix')} placeholder="aistudio-backup" value={sPrefix} onChange={setSPrefix} />
            <div className="flex items-center justify-between">
              <Label htmlFor="s-path" className="text-sm font-normal">
                {t('settings.backup.remote.s3.forcePathStyle')}
              </Label>
              <Switch id="s-path" checked={sPath} onCheckedChange={setSPath} />
            </div>
          </TabsContent>
        </Tabs>

        {testMsg && (
          <p className={testOk ? 'text-xs text-emerald-600' : 'text-xs text-destructive'}>
            {testMsg}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button variant="secondary" onClick={doTest} disabled={testing}>
            {testing ? t('settings.backup.remote.testing') : t('settings.backup.remote.testButton')}
          </Button>
          <Button onClick={doSave} disabled={!testOk}>
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field(props: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}): React.JSX.Element {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{props.label}</Label>
      <Input
        type={props.type ?? 'text'}
        placeholder={props.placeholder}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </div>
  )
}
```

- [ ] **Step 5：在 `BackupSection.tsx` 中替换"云端 placeholder"为带"配置远端 / 清除配置 / 测试连接"的 card（同步按钮在 Phase 5 接）**

把整段
```tsx
      {/* Cloud sync card — filled in Phase 5 */}
      <div className="rounded-xl border bg-card/50 p-5">
        <h3 className="text-sm font-semibold">{t('settings.backup.cloudTitle')}</h3>
        <p className="text-xs text-muted-foreground mt-1">{t('settings.backup.cloudComingSoon')}</p>
      </div>
```

替换为：

```tsx
      <CloudCard />

      <BackupRemoteDialog
        open={remoteDialogOpen}
        initial={remoteConfig}
        onCancel={() => setRemoteDialogOpen(false)}
        onSaved={() => setRemoteDialogOpen(false)}
      />
```

并在文件顶部追加 imports：
```tsx
import { BackupRemoteDialog } from './BackupRemoteDialog'
```

在 `BackupSection` 组件 state 段加：
```ts
const remoteConfig = useBackupStore((s) => s.remoteConfig)
const clearRemoteConfig = useBackupStore((s) => s.clearRemoteConfig)
const [remoteDialogOpen, setRemoteDialogOpen] = useState(false)
```

并在文件底部新增组件：

```tsx
function CloudCard(): React.JSX.Element {
  const { t } = useTranslation()
  const remoteConfig = useBackupStore((s) => s.remoteConfig)
  const clearRemoteConfig = useBackupStore((s) => s.clearRemoteConfig)
  const setRemoteDialogOpen = (() => {
    // Hoisted via prop in real impl; for clarity we expose a global event handler.
    // In practice, restructure CloudCard to receive `onConfigure` as a prop —
    // see the parent component above. The two-component split exists only to keep
    // BackupSection legible.
    return (_: boolean): void => {
      /* implemented in parent */
    }
  })()

  return (
    <div className="rounded-xl border bg-card/50 p-5 space-y-3">
      <h3 className="text-sm font-semibold">{t('settings.backup.cloudTitle')}</h3>
      {remoteConfig ? (
        <>
          <p className="text-xs text-muted-foreground">
            {t('settings.backup.cloudConfigured', {
              type: remoteConfig.type === 'webdav' ? 'WebDAV' : 'S3',
            })}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setRemoteDialogOpen(true)}>
              {t('settings.backup.reconfigureButton')}
            </Button>
            <Button variant="ghost" onClick={() => clearRemoteConfig()}>
              {t('settings.backup.clearConfigButton')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground italic">
            {t('settings.backup.syncButtonsComingSoon')}
          </p>
        </>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{t('settings.backup.cloudNotConfigured')}</p>
          <Button onClick={() => setRemoteDialogOpen(true)}>
            {t('settings.backup.configureButton')}
          </Button>
        </>
      )}
    </div>
  )
}
```

> **Restructure note:** Pass `onConfigure` and `remoteConfig` into `CloudCard` as props rather than the placeholder closure above. Keep `BackupSection` as the single state-owner for `remoteDialogOpen`. This makes the two-component split clean.

Final `CloudCard` signature should be:
```tsx
function CloudCard({
  remoteConfig,
  onConfigure,
  onClear,
}: {
  remoteConfig: RemoteConfig | null
  onConfigure: () => void
  onClear: () => Promise<void>
}): React.JSX.Element { ... }
```

And `BackupSection` calls `<CloudCard remoteConfig={remoteConfig} onConfigure={() => setRemoteDialogOpen(true)} onClear={clearRemoteConfig} />`.

- [ ] **Step 6：locale 文件追加 remote 段（en + zh-CN）**

`en.json` 的 `settings.backup` 块内追加：

```json
"cloudConfigured": "Configured ({{type}})",
"cloudNotConfigured": "Not configured.",
"configureButton": "Configure remote…",
"reconfigureButton": "Reconfigure…",
"clearConfigButton": "Clear",
"syncButtonsComingSoon": "Sync controls available once configured.",
"remote": {
  "dialogTitle": "Cloud backup destination",
  "dialogDesc": "Test the connection before saving. Credentials are stored encrypted by your OS keychain.",
  "testButton": "Test connection",
  "testing": "Testing…",
  "testOk": "Connection OK ({{latency}} ms)",
  "webdav": {
    "url": "Server URL",
    "username": "Username",
    "password": "Password",
    "subPath": "Sub-path"
  },
  "s3": {
    "endpoint": "Endpoint",
    "region": "Region",
    "bucket": "Bucket",
    "accessKeyId": "Access Key ID",
    "secretAccessKey": "Secret Access Key",
    "prefix": "Object key prefix",
    "forcePathStyle": "Force path-style addressing"
  }
}
```

`zh-CN.json` 同位置：

```json
"cloudConfigured": "已配置（{{type}}）",
"cloudNotConfigured": "尚未配置。",
"configureButton": "配置远端…",
"reconfigureButton": "重新配置…",
"clearConfigButton": "清除",
"syncButtonsComingSoon": "配置完成后才能使用同步按钮。",
"remote": {
  "dialogTitle": "云端备份目的地",
  "dialogDesc": "保存前请先测试连接。凭据将由系统密钥链加密保存。",
  "testButton": "测试连接",
  "testing": "正在测试…",
  "testOk": "连接成功（耗时 {{latency}} ms）",
  "webdav": {
    "url": "服务器 URL",
    "username": "用户名",
    "password": "密码",
    "subPath": "子路径"
  },
  "s3": {
    "endpoint": "Endpoint",
    "region": "Region",
    "bucket": "Bucket",
    "accessKeyId": "Access Key ID",
    "secretAccessKey": "Secret Access Key",
    "prefix": "对象键前缀",
    "forcePathStyle": "强制 path-style 寻址"
  }
}
```

- [ ] **Step 7：typecheck + format + 手动冒烟**

```bash
npm run typecheck && npm run format
npm run dev
```

冒烟：
1. 在"数据备份"页点"配置远端…"
2. 切到 WebDAV/S3 任一 Tab，填写一个真实可用的目的地（如本机起的 MinIO 或坚果云 WebDAV）
3. 点"测试连接"应当显示 OK + 延时
4. 点"保存"应能成功；再次打开 Settings 应记住已配置
5. 点"清除"应清空配置并回到未配置状态

- [ ] **Step 8：commit**

```bash
git add \
  src/main/db/settings.ts \
  src/main/backup/index.ts \
  src/main/ipc/backup-handlers.ts \
  src/renderer/src/components/settings/BackupRemoteDialog.tsx \
  src/renderer/src/components/settings/BackupSection.tsx \
  src/renderer/src/i18n/locales/en.json \
  src/renderer/src/i18n/locales/zh-CN.json
git commit -m "feat(backup): cloud remote configuration UI + WebDAV/S3 wiring"
```

**Phase 4 milestone：可在 UI 配置远端并测试连通。**

---

# Phase 5 — 同步引擎

## Task 18：dirty-tracker

**Files:**
- Create: `src/main/backup/dirty-tracker.ts`
- Modify: `src/main/ipc/index.ts`

- [ ] **Step 1：创建 dirty-tracker**

```ts
import { ipcMain } from 'electron'
import { setSetting } from '../db/settings'

const TRACKED_PREFIX = new Set([
  'provider',
  'model',
  'assistant',
  'phrase',
  'model-definition',
  'model-group',
  'quick-action',
  'selection-action',
  'settings',
])
const TRACKED_VERB = new Set(['create', 'update', 'delete', 'reorder', 'set', 'set-batch'])

let initialized = false

/**
 * Wraps `ipcMain.handle` so that any registered handler whose channel name matches
 * `<tracked-domain>:<tracked-verb>` automatically updates `backup.lastLocalChangeAt`
 * after the original handler returns. Must be called BEFORE `registerAllIpcHandlers`.
 */
export function installDirtyTracker(): void {
  if (initialized) return
  initialized = true
  const original = ipcMain.handle.bind(ipcMain)
  ipcMain.handle = (channel: string, listener: Parameters<typeof original>[1]) => {
    if (shouldTrack(channel)) {
      const wrapped: typeof listener = async (event, ...args) => {
        const result = await listener(event, ...args)
        try {
          // Don't mark dirty for our own backup.* settings changes — would cause loops.
          if (channel === 'settings:set' || channel === 'settings:set-batch') {
            const firstArg = args[0]
            if (looksLikeBackupOnly(firstArg)) return result
          }
          setSetting('backup.lastLocalChangeAt', new Date().toISOString())
        } catch {
          /* best-effort */
        }
        return result
      }
      return original(channel, wrapped)
    }
    return original(channel, listener)
  }
}

function shouldTrack(channel: string): boolean {
  const colon = channel.indexOf(':')
  if (colon < 0) return false
  const domain = channel.slice(0, colon)
  const verb = channel.slice(colon + 1)
  if (!TRACKED_PREFIX.has(domain)) return false
  return TRACKED_VERB.has(verb)
}

function looksLikeBackupOnly(arg: unknown): boolean {
  if (typeof arg === 'string') return arg.startsWith('backup.')
  if (arg && typeof arg === 'object') {
    const keys = Object.keys(arg as Record<string, unknown>)
    return keys.length > 0 && keys.every((k) => k.startsWith('backup.'))
  }
  return false
}
```

- [ ] **Step 2：在 `src/main/ipc/index.ts` 顶部导入并在 `registerAllIpcHandlers` 第一行调用**

```ts
import { installDirtyTracker } from '../backup/dirty-tracker'

export function registerAllIpcHandlers(): void {
  installDirtyTracker()
  registerConversationHandlers()
  // ...rest unchanged
}
```

- [ ] **Step 3：typecheck + format + commit**

```bash
npm run typecheck && npm run format
git add src/main/backup/dirty-tracker.ts src/main/ipc/index.ts
git commit -m "feat(backup): dirty-tracker for lastLocalChangeAt"
```

---

## Task 19：`BackupSyncService`

**Files:**
- Create: `src/main/backup/sync-service.ts`
- Modify: `src/main/index.ts` (boot)

- [ ] **Step 1：创建 sync-service**

```ts
import { BrowserWindow } from 'electron'
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import type {
  BackupProgress,
  RemoteBackupItem,
  RemoteConfig,
  SyncResult,
  SyncStatus,
} from '@shared/types'
import { ERROR_CODES } from '@shared/errors'
import { AppError, toLocalizedError } from '../errors'
import { IpcChannels } from '@shared/ipc-channels'
import { getDataDir } from '../utils/paths'
import { getSetting, setSetting } from '../db/settings'
import {
  applyEncryptedBytes,
  buildRemote,
  encodeSnapshotBytes,
  loadRemoteConfig,
  peekBackupFile,
} from '.'
import type { BackupRemote, RemoteObject } from './remote/types'

const MANIFEST_KEY = 'manifest.json'
const BACKUPS_PREFIX = 'backups/'
const ROLLBACK_DIR = 'auto-rollback'
const CLOCK_TOLERANCE_MS = 1_000

interface Manifest {
  latestBackupKey: string
  latestCreatedAt: string
  schemaVersion: 1
}

class BackupSyncService {
  private syncing = false
  private currentAbort: AbortController | null = null
  private timer: NodeJS.Timeout | null = null
  private lastWarning: string | null = null

  /** Read current settings + activity into a SyncStatus object. */
  getStatus(): SyncStatus {
    return {
      isSyncing: this.syncing,
      lastLocalChangeAt: getSetting('backup.lastLocalChangeAt') ?? null,
      lastSyncedAt: getSetting('backup.lastSyncedAt') ?? null,
      lastRemoteSeenAt: getSetting('backup.lastRemoteSeenAt') ?? null,
      lastError: null, // populated when syncNow throws — kept transient in memory
      lastWarning: this.lastWarning,
      hasRemoteConfigured: !!getSetting('backup.remote.type'),
      autoSyncIntervalMinutes: parseInt(getSetting('backup.autoSyncIntervalMinutes') ?? '0', 10),
    }
  }

  cancel(): void {
    this.currentAbort?.abort()
  }

  /** Configure / reconfigure the auto-sync timer based on current settings. */
  scheduleAuto(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    const minutes = parseInt(getSetting('backup.autoSyncIntervalMinutes') ?? '0', 10)
    if (minutes < 5) return
    const ms = minutes * 60 * 1000
    this.timer = setInterval(() => {
      this.syncNow().catch((e) => {
        // Auto-sync failures: don't toast, just remember for the badge.
        this.lastWarning = e instanceof Error ? e.message : String(e)
        this.broadcastStatus(toLocalizedError(e))
      })
    }, ms)
  }

  /** Single sync round trip. */
  async syncNow(): Promise<SyncResult> {
    if (this.syncing) throw new AppError(ERROR_CODES.BACKUP_BUSY)
    const cfg = loadRemoteConfig()
    if (!cfg) throw new AppError(ERROR_CODES.BACKUP_REMOTE_NOT_CONFIGURED)

    this.syncing = true
    this.currentAbort = new AbortController()
    this.broadcastStatus(null)

    try {
      const remote = buildRemote(cfg)
      const localChange = parseIso(getSetting('backup.lastLocalChangeAt'))
      const password = getSetting('backup.syncPassphrase')
      if (!password) throw new AppError(ERROR_CODES.BACKUP_FILE_INVALID, undefined, 'Sync passphrase missing')

      const manifest = await this.fetchManifest(remote)
      const remoteCreated = manifest ? parseIso(manifest.latestCreatedAt) : null

      let result: SyncResult
      if (manifest === null) {
        result = await this.uploadFlow(remote, password, cfg)
      } else if (localChange === null) {
        result = await this.downloadFlow(remote, password, manifest)
      } else if (remoteCreated === null) {
        result = await this.uploadFlow(remote, password, cfg)
      } else if (Math.abs(localChange - remoteCreated) <= CLOCK_TOLERANCE_MS) {
        result = { direction: 'noop' }
      } else if (localChange > remoteCreated) {
        result = await this.uploadFlow(remote, password, cfg)
      } else {
        result = await this.downloadFlow(remote, password, manifest)
      }

      setSetting('backup.lastSyncedAt', new Date().toISOString())
      if (result.createdAt) setSetting('backup.lastRemoteSeenAt', result.createdAt)
      this.lastWarning = null
      this.broadcastStatus(null)
      return result
    } catch (e) {
      if (this.currentAbort?.signal.aborted) {
        const cancelled: SyncResult = { direction: 'cancelled' }
        this.broadcastStatus(null)
        return cancelled
      }
      this.broadcastStatus(toLocalizedError(e))
      throw e
    } finally {
      this.syncing = false
      this.currentAbort = null
    }
  }

  async listRemote(): Promise<RemoteBackupItem[]> {
    const cfg = loadRemoteConfig()
    if (!cfg) throw new AppError(ERROR_CODES.BACKUP_REMOTE_NOT_CONFIGURED)
    const remote = buildRemote(cfg)
    const objects = await remote.list(BACKUPS_PREFIX)
    const out: RemoteBackupItem[] = []
    for (const obj of objects) {
      let createdAt = obj.lastModified
      let appVersion = ''
      // Best-effort: peek each file. For very large lists this is expensive; cap at 50.
      if (out.length < 50) {
        try {
          const bytes = await remote.get(obj.key)
          const meta = peekBackupFile(new TextDecoder().decode(bytes))
          createdAt = meta.createdAt
          appVersion = meta.appVersion
        } catch {
          /* tolerate */
        }
      }
      out.push({
        key: obj.key,
        size: obj.size,
        lastModified: obj.lastModified,
        createdAt,
        appVersion,
      })
    }
    out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    return out
  }

  async restoreFromKey(key: string, password: string, mode: 'replace' | 'merge'): Promise<void> {
    const cfg = loadRemoteConfig()
    if (!cfg) throw new AppError(ERROR_CODES.BACKUP_REMOTE_NOT_CONFIGURED)
    const remote = buildRemote(cfg)
    this.progress({ phase: 'download' })
    const bytes = await remote.get(key)
    this.progress({ phase: 'decrypt' })
    this.writeRollback(bytes)
    this.progress({ phase: 'apply' })
    applyEncryptedBytes(bytes, password, mode)
    setSetting('backup.lastSyncedAt', new Date().toISOString())
    this.broadcastStatus(null)
  }

  // ---------- private helpers ----------

  private async fetchManifest(remote: BackupRemote): Promise<Manifest | null> {
    try {
      const bytes = await remote.get(MANIFEST_KEY)
      const text = new TextDecoder().decode(bytes)
      const m = JSON.parse(text) as Manifest
      if (m.schemaVersion !== 1) return null
      return m
    } catch (e) {
      if (e instanceof AppError && e.code === ERROR_CODES.BACKUP_REMOTE_NOT_FOUND) return null
      throw e
    }
  }

  private async uploadFlow(
    remote: BackupRemote,
    password: string,
    _cfg: RemoteConfig,
  ): Promise<SyncResult> {
    this.progress({ phase: 'collect' })
    const { bytes, createdAt } = encodeSnapshotBytes(password)
    if (this.currentAbort?.signal.aborted) throw new AppError(ERROR_CODES.BACKUP_CANCELLED)

    const key = `${BACKUPS_PREFIX}${safeKeyTimestamp(createdAt)}.aibackup`
    this.progress({ phase: 'upload' })
    await remote.put(key, bytes)

    // Manifest LAST — crash-safe.
    const manifest: Manifest = { latestBackupKey: key, latestCreatedAt: createdAt, schemaVersion: 1 }
    await remote.put(MANIFEST_KEY, new TextEncoder().encode(JSON.stringify(manifest, null, 2)))

    // Cleanup old backups beyond retention.
    this.progress({ phase: 'cleanup' })
    await this.pruneRemote(remote)
    return { direction: 'upload', createdAt }
  }

  private async downloadFlow(
    remote: BackupRemote,
    password: string,
    manifest: Manifest,
  ): Promise<SyncResult> {
    this.progress({ phase: 'download' })
    const bytes = await remote.get(manifest.latestBackupKey)
    if (this.currentAbort?.signal.aborted) throw new AppError(ERROR_CODES.BACKUP_CANCELLED)

    this.writeRollback(bytes)
    this.progress({ phase: 'decrypt' })
    this.progress({ phase: 'apply' })
    applyEncryptedBytes(bytes, password, 'replace')
    return { direction: 'download', createdAt: manifest.latestCreatedAt }
  }

  private writeRollback(latestBytes: Uint8Array): void {
    const dir = join(getDataDir(), 'backups', ROLLBACK_DIR)
    mkdirSync(dir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    writeFileSync(join(dir, `pre-apply-${stamp}.aibackup`), Buffer.from(latestBytes))
    this.pruneLocalRollbacks(dir)
  }

  private pruneLocalRollbacks(dir: string): void {
    const max = parseInt(getSetting('backup.maxRetainedBackups') ?? '5', 10)
    if (max <= 0) return
    if (!existsSync(dir)) return
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.aibackup'))
      .map((name) => ({ name, full: join(dir, name) }))
      .sort((a, b) => (a.name < b.name ? 1 : -1))
    for (const f of files.slice(max)) {
      try {
        rmSync(f.full, { force: true })
      } catch {
        /* tolerate */
      }
    }
  }

  private async pruneRemote(remote: BackupRemote): Promise<void> {
    const max = parseInt(getSetting('backup.maxRetainedBackups') ?? '5', 10)
    if (max <= 0) return
    let objects: RemoteObject[] = []
    try {
      objects = await remote.list(BACKUPS_PREFIX)
    } catch (e) {
      this.lastWarning = `prune list failed: ${e instanceof Error ? e.message : String(e)}`
      return
    }
    const sorted = [...objects]
      .filter((o) => o.key.endsWith('.aibackup'))
      .sort((a, b) => (a.key < b.key ? 1 : -1))
    for (const o of sorted.slice(max)) {
      try {
        await remote.delete(o.key)
      } catch {
        /* tolerate */
      }
    }
  }

  private progress(p: BackupProgress): void {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IpcChannels.BACKUP_PROGRESS, p)
    }
  }

  private broadcastStatus(err: ReturnType<typeof toLocalizedError> | null): void {
    const status: SyncStatus = { ...this.getStatus(), lastError: err }
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IpcChannels.BACKUP_STATUS_CHANGED, status)
    }
  }
}

function parseIso(s: string | null | undefined): number | null {
  if (!s) return null
  const t = Date.parse(s)
  return Number.isFinite(t) ? t : null
}

function safeKeyTimestamp(iso: string): string {
  // Object keys in S3/WebDAV must avoid `:` — replace with `-`.
  return iso.replace(/[:.]/g, '-')
}

export const backupSyncService = new BackupSyncService()
```

- [ ] **Step 2：在 `src/main/index.ts` 启动时初始化定时器**

定位到主窗口创建之后、IPC 注册之后、tray 设置之前的某个位置（`app.whenReady().then(...)` 内），追加：

```ts
import { backupSyncService } from './backup/sync-service'
// ...
backupSyncService.scheduleAuto()
```

并在 `settings:set` 触发后重新调度——为简化，让 dirty-tracker 之外的 settings handler 在写入 `backup.autoSyncIntervalMinutes` 时调用 `backupSyncService.scheduleAuto()`。最简单的做法：在 `src/main/ipc/settings-handlers.ts` 的 `set` / `set-batch` handler 末尾加：

```ts
import { backupSyncService } from '../backup/sync-service'
// ... 在 set/set-batch 完成后：
if (key === 'backup.autoSyncIntervalMinutes' /* 或 entries 中含此 key */) {
  backupSyncService.scheduleAuto()
}
```

- [ ] **Step 3：typecheck + format + commit**

```bash
npm run typecheck && npm run format
git add src/main/backup/sync-service.ts src/main/index.ts src/main/ipc/settings-handlers.ts
git commit -m "feat(backup): BackupSyncService with manifest + LWW + retention"
```

---

## Task 20：sync IPC handlers + 用户口令注入

**Files:**
- Modify: `src/main/ipc/backup-handlers.ts`

- [ ] **Step 1：在 `backup-handlers.ts` 顶部 import 区追加**

```ts
import { backupSyncService } from '../backup/sync-service'
import { setSetting } from '../db/settings'
import type { BackupImportMode, RemoteBackupItem, SyncResult, SyncStatus } from '@shared/types'
```

- [ ] **Step 2：在 `registerBackupHandlers()` 中追加**

```ts
  ipcMain.handle(IpcChannels.BACKUP_SYNC_NOW, async (): Promise<IpcResult<SyncResult>> => {
    try {
      const data = await backupSyncService.syncNow()
      return { success: true, data }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(IpcChannels.BACKUP_SYNC_CANCEL, (): IpcResult<void> => {
    try {
      backupSyncService.cancel()
      return { success: true }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(IpcChannels.BACKUP_LIST_REMOTE, async (): Promise<IpcResult<RemoteBackupItem[]>> => {
    try {
      const data = await backupSyncService.listRemote()
      return { success: true, data }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(
    IpcChannels.BACKUP_RESTORE_FROM_REMOTE,
    async (
      _,
      payload: { key: string; password: string; mode: BackupImportMode },
    ): Promise<IpcResult<void>> => {
      try {
        await backupSyncService.restoreFromKey(payload.key, payload.password, payload.mode)
        return { success: true }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(IpcChannels.BACKUP_GET_STATUS, (): IpcResult<SyncStatus> => {
    try {
      return { success: true, data: backupSyncService.getStatus() }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })
```

- [ ] **Step 3：扩展 `BACKUP_SET_REMOTE_CONFIG` handler，让它同时写入用户的同步口令**

把 Step 3-of-Task-17 的 `BACKUP_SET_REMOTE_CONFIG` handler 替换为带可选 `passphrase` 字段的版本：

```ts
  ipcMain.handle(
    IpcChannels.BACKUP_SET_REMOTE_CONFIG,
    (_, payload: { config: RemoteConfig; passphrase?: string }): IpcResult<void> => {
      try {
        saveRemoteConfig(payload.config)
        if (payload.passphrase) setSetting('backup.syncPassphrase', payload.passphrase)
        return { success: true }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )
```

并相应修改 preload + store 中 `setRemoteConfig` 的签名：

`preload/index.ts`：
```ts
    setRemoteConfig: (cfg: RemoteConfig, passphrase?: string): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IpcChannels.BACKUP_SET_REMOTE_CONFIG, { config: cfg, passphrase }),
```

`backupStore.ts` 的 `setRemoteConfig`：
```ts
  setRemoteConfig: async (cfg, passphrase) => {
    const r = await window.api.backup.setRemoteConfig(cfg, passphrase)
    // ...rest unchanged
  },
```
对应的接口签名也要改：
```ts
setRemoteConfig: (cfg: RemoteConfig, passphrase?: string) => Promise<void | { error: LocalizedError }>
```

- [ ] **Step 4：typecheck + format + commit**

```bash
npm run typecheck && npm run format
git add \
  src/main/ipc/backup-handlers.ts \
  src/preload/index.ts \
  src/renderer/src/stores/backupStore.ts
git commit -m "feat(backup): sync IPC handlers + sync passphrase persistence"
```

---

## Task 21：UI — 同步按钮、定时器选项、保留份数、历史对话框

**Files:**
- Create: `src/renderer/src/components/settings/BackupHistoryDialog.tsx`
- Modify: `src/renderer/src/components/settings/BackupSection.tsx`
- Modify: `src/renderer/src/components/settings/BackupRemoteDialog.tsx` (可选：在保存配置时同时索取同步口令)
- Modify: locale files

- [ ] **Step 1：创建 `BackupHistoryDialog.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { useBackupStore } from '@renderer/stores/backupStore'
import { useLocalizedError } from '@renderer/hooks/useLocalizedError'
import type { BackupImportMode, RemoteBackupItem } from '@shared/types'
import { BackupPasswordDialog } from './BackupPasswordDialog'
import { toast } from 'sonner'

export function BackupHistoryDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const localizedError = useLocalizedError()
  const listRemote = useBackupStore((s) => s.listRemote)
  const restoreFromRemote = useBackupStore((s) => s.restoreFromRemote)

  const [items, setItems] = useState<RemoteBackupItem[]>([])
  const [loading, setLoading] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [mode, setMode] = useState<BackupImportMode>('replace')
  const [pwError, setPwError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    listRemote().then((r) => {
      setLoading(false)
      if (Array.isArray(r)) setItems(r)
      else toast.error(localizedError(r.error))
    })
  }, [open, listRemote, localizedError])

  const onPickRestore = (key: string, m: BackupImportMode): void => {
    setPendingKey(key)
    setMode(m)
    setPwError(null)
    setPwOpen(true)
  }

  const onPwSubmit = async (password: string): Promise<void> => {
    if (!pendingKey) return
    const r = await restoreFromRemote(pendingKey, password, mode)
    if (r && 'error' in r) {
      if (r.error.code === 'errors.backup.passwordWrong') {
        setPwError(t('errors.backup.passwordWrong'))
        return
      }
      toast.error(localizedError(r.error))
    } else {
      toast.success(t('settings.backup.history.restoreOk'))
    }
    setPwOpen(false)
    setPendingKey(null)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('settings.backup.history.title')}</DialogTitle>
            <DialogDescription>{t('settings.backup.history.desc')}</DialogDescription>
          </DialogHeader>

          {loading ? (
            <p className="text-sm text-muted-foreground">{t('settings.backup.history.loading')}</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('settings.backup.history.empty')}</p>
          ) : (
            <div className="max-h-96 overflow-auto rounded-md border divide-y">
              {items.map((item) => (
                <div key={item.key} className="flex items-center justify-between p-3 gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{item.key}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString()}
                      {item.appVersion ? ` · v${item.appVersion}` : ''}
                      {' · '}
                      {(item.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onPickRestore(item.key, 'replace')}>
                      {t('settings.backup.history.restoreReplace')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onPickRestore(item.key, 'merge')}>
                      {t('settings.backup.history.restoreMerge')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BackupPasswordDialog
        open={pwOpen}
        mode="restore"
        errorText={pwError}
        onCancel={() => {
          setPwOpen(false)
          setPendingKey(null)
        }}
        onSubmit={onPwSubmit}
      />
    </>
  )
}
```

- [ ] **Step 2：在 `BackupSection.tsx` 的云端 card 内补全所有控件**

完整版 `CloudCard`（替换 Task 17 中的版本）：

```tsx
function CloudCard({
  remoteConfig,
  status,
  onConfigure,
  onClear,
  onSyncNow,
  onOpenHistory,
  onIntervalChange,
  onMaxRetainedChange,
}: {
  remoteConfig: RemoteConfig | null
  status: SyncStatus | null
  onConfigure: () => void
  onClear: () => Promise<void>
  onSyncNow: () => Promise<void>
  onOpenHistory: () => void
  onIntervalChange: (minutes: number) => Promise<void>
  onMaxRetainedChange: (n: number) => Promise<void>
}): React.JSX.Element {
  const { t } = useTranslation()
  const localizedError = useLocalizedError()

  if (!remoteConfig) {
    return (
      <div className="rounded-xl border bg-card/50 p-5 space-y-3">
        <h3 className="text-sm font-semibold">{t('settings.backup.cloudTitle')}</h3>
        <p className="text-xs text-muted-foreground">{t('settings.backup.cloudNotConfigured')}</p>
        <Button onClick={onConfigure}>{t('settings.backup.configureButton')}</Button>
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-card/50 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{t('settings.backup.cloudTitle')}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {t('settings.backup.cloudConfigured', {
              type: remoteConfig.type === 'webdav' ? 'WebDAV' : 'S3',
            })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs">
          {status?.lastSyncedAt && (
            <span className="text-muted-foreground">
              {t('settings.backup.lastSynced', { at: new Date(status.lastSyncedAt).toLocaleString() })}
            </span>
          )}
          {status?.lastLocalChangeAt && (
            <span className="text-muted-foreground">
              {t('settings.backup.lastChanged', { at: new Date(status.lastLocalChangeAt).toLocaleString() })}
            </span>
          )}
          {status?.lastError && <span className="text-destructive">{localizedError(status.lastError)}</span>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={onSyncNow} disabled={status?.isSyncing}>
          {status?.isSyncing ? t('settings.backup.syncing') : t('settings.backup.syncNowButton')}
        </Button>
        <Button variant="outline" onClick={onOpenHistory}>
          {t('settings.backup.historyButton')}
        </Button>
        <Button variant="ghost" onClick={onConfigure}>
          {t('settings.backup.reconfigureButton')}
        </Button>
        <Button variant="ghost" onClick={onClear}>
          {t('settings.backup.clearConfigButton')}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">{t('settings.backup.intervalLabel')}</Label>
          <select
            className="mt-1 w-full h-9 rounded-md border bg-background px-2 text-sm"
            value={status?.autoSyncIntervalMinutes ?? 0}
            onChange={(e) => onIntervalChange(parseInt(e.target.value, 10))}>
            <option value={0}>{t('settings.backup.intervalOff')}</option>
            <option value={15}>{t('settings.backup.interval15')}</option>
            <option value={30}>{t('settings.backup.interval30')}</option>
            <option value={60}>{t('settings.backup.interval60')}</option>
            <option value={180}>{t('settings.backup.interval180')}</option>
            <option value={720}>{t('settings.backup.interval720')}</option>
          </select>
        </div>
        <div>
          <Label className="text-xs">{t('settings.backup.maxRetainedLabel')}</Label>
          <Input
            type="number"
            min={1}
            max={50}
            className="mt-1"
            value={parseInt(useSettingValue('backup.maxRetainedBackups') ?? '5', 10)}
            onChange={(e) => onMaxRetainedChange(Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 5)))}
          />
        </div>
      </div>
    </div>
  )
}

function useSettingValue(key: string): string | undefined {
  // Read from settingsStore. If the project's settings store exposes a different
  // accessor, swap accordingly.
  const value = useSettingsStore((s) => s.settings?.[key])
  return value
}
```

并在 `BackupSection` 顶部加：
```tsx
import { Input } from '@renderer/components/ui/input'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { BackupHistoryDialog } from './BackupHistoryDialog'
import type { SyncStatus, RemoteConfig } from '@shared/types'
```

并把 `BackupSection` 内的 `<CloudCard ... />` 调用替换为：

```tsx
const status = useBackupStore((s) => s.status)
const syncNow = useBackupStore((s) => s.syncNow)
const setIntervalMin = async (m: number): Promise<void> => {
  await window.api.setSetting('backup.autoSyncIntervalMinutes', String(m))
  await useBackupStore.getState().loadStatus()
}
const setMaxRetained = async (n: number): Promise<void> => {
  await window.api.setSetting('backup.maxRetainedBackups', String(n))
}
const [historyOpen, setHistoryOpen] = useState(false)

const handleSyncNow = async (): Promise<void> => {
  const r = await syncNow()
  if ('error' in r) {
    toast.error(localizedError(r.error))
    return
  }
  toast.success(t('settings.backup.syncResult.' + r.direction))
}

return (
  // ...keep header + local card unchanged, then:
  <CloudCard
    remoteConfig={remoteConfig}
    status={status}
    onConfigure={() => setRemoteDialogOpen(true)}
    onClear={() => clearRemoteConfig()}
    onSyncNow={handleSyncNow}
    onOpenHistory={() => setHistoryOpen(true)}
    onIntervalChange={setIntervalMin}
    onMaxRetainedChange={setMaxRetained}
  />

  <BackupRemoteDialog ... />
  <BackupHistoryDialog open={historyOpen} onClose={() => setHistoryOpen(false)} />
  // ...
)
```

> **Note:** `window.api.setSetting` is the existing `settings:set` wrapper — confirm exact name from preload (it may be `setSetting(key, value)`). The settings store generally exposes a setter; prefer `useSettingsStore.getState().setSetting(...)` if available.

- [ ] **Step 3：让 `BackupRemoteDialog` 在保存时一并要求"同步口令"**

在 dialog 中加一个 `<Field>` 行：

```tsx
const [passphrase, setPassphrase] = useState('')
// ... in render, before the buttons:
<Field
  label={t('settings.backup.remote.passphrase')}
  type="password"
  value={passphrase}
  onChange={setPassphrase}
/>
```

并把 `doSave` 改成：
```ts
const doSave = async (): Promise<void> => {
  if (!testOk) return
  if (!passphrase) {
    setTestMsg(t('settings.backup.remote.passphraseRequired'))
    return
  }
  const r = await setRemoteConfig(buildCfg(), passphrase)
  if (r && 'error' in r) {
    setTestMsg(localizedError(r.error))
    return
  }
  onSaved()
}
```

- [ ] **Step 4：locale 追加（en + zh-CN）**

`en.json` 的 `settings.backup` 内新增：
```json
"syncNowButton": "Sync now",
"syncing": "Syncing…",
"historyButton": "History…",
"lastSynced": "Last synced: {{at}}",
"lastChanged": "Last local change: {{at}}",
"intervalLabel": "Auto-sync every",
"intervalOff": "Off",
"interval15": "15 min",
"interval30": "30 min",
"interval60": "1 hour",
"interval180": "3 hours",
"interval720": "12 hours",
"maxRetainedLabel": "Max retained backups (1-50)",
"syncResult": {
  "upload": "Uploaded local changes to cloud.",
  "download": "Downloaded latest cloud backup.",
  "noop": "Already in sync.",
  "cancelled": "Sync was cancelled."
},
"history": {
  "title": "Cloud backup history",
  "desc": "Pick a snapshot to restore. Replace clears local data first; merge keeps local-only rows.",
  "loading": "Loading…",
  "empty": "No backups in the cloud yet.",
  "restoreReplace": "Restore (replace)",
  "restoreMerge": "Restore (merge)",
  "restoreOk": "Snapshot restored."
},
"remote": {
  "passphrase": "Sync encryption password",
  "passphraseRequired": "Please set an encryption password for cloud backups."
}
```

`zh-CN.json` 的对应位置：
```json
"syncNowButton": "立即同步",
"syncing": "同步中…",
"historyButton": "历史版本…",
"lastSynced": "上次同步：{{at}}",
"lastChanged": "最后本地修改：{{at}}",
"intervalLabel": "自动同步间隔",
"intervalOff": "关闭",
"interval15": "15 分钟",
"interval30": "30 分钟",
"interval60": "1 小时",
"interval180": "3 小时",
"interval720": "12 小时",
"maxRetainedLabel": "最大保留备份数（1-50）",
"syncResult": {
  "upload": "已将本地变更上传到云端。",
  "download": "已下载并应用云端最新备份。",
  "noop": "已是最新状态。",
  "cancelled": "同步已取消。"
},
"history": {
  "title": "云端备份历史",
  "desc": "选择一份快照恢复；替换会先清空本地数据，合并会保留本地独有记录。",
  "loading": "正在加载…",
  "empty": "云端还没有备份。",
  "restoreReplace": "恢复（替换）",
  "restoreMerge": "恢复（合并）",
  "restoreOk": "快照已恢复。"
},
"remote": {
  "passphrase": "同步加密口令",
  "passphraseRequired": "请为云端备份设置加密口令。"
}
```

- [ ] **Step 5：typecheck + format + 手动冒烟**

```bash
npm run typecheck && npm run format
npm run dev
```

冒烟：
1. 配置远端 + 同步口令 → 保存
2. 点"立即同步" → toast 应该显示 "Uploaded local changes to cloud."；远端应能看到 `manifest.json` + `backups/xxx.aibackup`
3. 在另一台设备上（或清空本机数据后）配置同样的远端 + 相同口令 → 点"立即同步" → 应自动下载并应用
4. 修改一些设置，等 `lastLocalChangeAt` 比 `latestCreatedAt` 新；再点立即同步 → 应上传
5. 设置"自动同步间隔" 为 15 分钟，刷新一次 status，确认 `autoSyncIntervalMinutes = 15`
6. 设置"最大保留备份数" 为 2，连续上传 3-4 次，确认远端 `backups/` 下只剩 2 份
7. 打开"历史版本…" → 列出备份，选一份"恢复（合并）" → 输入口令 → 应用成功

- [ ] **Step 6：commit**

```bash
git add \
  src/renderer/src/components/settings/BackupHistoryDialog.tsx \
  src/renderer/src/components/settings/BackupSection.tsx \
  src/renderer/src/components/settings/BackupRemoteDialog.tsx \
  src/renderer/src/i18n/locales/en.json \
  src/renderer/src/i18n/locales/zh-CN.json
git commit -m "feat(backup): cloud sync UI — sync now, intervals, history dialog"
```

**Phase 5 milestone：手动 + 定时同步可用。**

---

# Phase 6 — Polish

## Task 22：补完所有错误码 i18n + 进度条 toast 集成

**Files:**
- Modify: `src/renderer/src/components/settings/BackupSection.tsx`

- [ ] **Step 1：在 `BackupSection.tsx` 内订阅 `progress` 并在长操作时显示一个轻量的进度文本**

在组件顶部加：
```ts
const progress = useBackupStore((s) => s.progress)
```

在 JSX 顶部、Local card 之上加：
```tsx
{progress && progress.phase !== 'apply' && (
  <div className="rounded-md border bg-card/50 px-3 py-2 text-xs text-muted-foreground">
    {t('settings.backup.progress.' + progress.phase)}
    {typeof progress.percent === 'number' ? ` (${progress.percent}%)` : ''}
  </div>
)}
```

- [ ] **Step 2：补 progress 文案到两个 locale**

`en.json` 的 `settings.backup` 加：
```json
"progress": {
  "collect": "Collecting configuration…",
  "encrypt": "Encrypting…",
  "upload": "Uploading…",
  "download": "Downloading…",
  "decrypt": "Decrypting…",
  "apply": "Applying…",
  "cleanup": "Cleaning up old backups…"
}
```

`zh-CN.json` 同位置：
```json
"progress": {
  "collect": "正在收集配置…",
  "encrypt": "正在加密…",
  "upload": "正在上传…",
  "download": "正在下载…",
  "decrypt": "正在解密…",
  "apply": "正在应用…",
  "cleanup": "正在清理旧备份…"
}
```

- [ ] **Step 3：format + commit**

```bash
npm run typecheck && npm run format
git add src/renderer/src/components/settings/BackupSection.tsx src/renderer/src/i18n/locales/en.json src/renderer/src/i18n/locales/zh-CN.json
git commit -m "feat(backup): progress indicator + i18n polish"
```

---

## Task 23：终末手动冒烟 + 清理

- [ ] **Step 1：完整冒烟列表（手动）**

```bash
npm run dev
```

按顺序验证：

1. **本地导出/导入**
   - 导出文件，记下口令
   - 用文本编辑器查看文件首部，确认 `magic` / `schemaVersion` / `appVersion` / `createdAt` 字段存在
   - 关闭应用，把 `data/ai-studio.db` 删掉再启动 — 应回到全新状态
   - 导入刚才的备份（替换模式） — 所有 provider/assistant/快捷键/主题/快捷助手动作全部恢复
   - 故意输错口令 — 显示"口令错误"
   - 切换合并模式，再次导入 — 不报错，rows 总数不变

2. **云端同步（用 MinIO 或坚果云 WebDAV 当远端）**
   - 配置 + 测试 + 设置同步口令 + 保存
   - 立即同步（首次）→ 远端出现 `manifest.json` + `backups/xxx.aibackup`
   - 修改任意设置（如主题）→ 立即同步 → 远端 `manifest.json` 的 `latestCreatedAt` 应更新
   - 删除本机 DB 启动 → 立即同步 → 自动下载并恢复
   - 故意网络断开 → 立即同步 → 报"网络错误"，本地数据不变

3. **保留份数**
   - 设为 2 → 连续手动同步 4 次（每次先小修改）→ 远端只剩 2 份

4. **历史恢复**
   - 打开"历史版本…" → 选一份非最新 → 输入口令 → 恢复（合并）
   - 验证恢复后的内容与所选快照一致

5. **回滚副本**
   - `data/backups/auto-rollback/` 下应出现 `pre-apply-*.aibackup`，按时间戳保留 N 份

6. **typecheck**
   ```bash
   npm run typecheck
   ```
   PASS

7. **lint**
   ```bash
   npm run lint
   ```
   零新增 warning / error

- [ ] **Step 2：如果冒烟有问题，记下并修，**对每个修一个独立 commit**：
   ```bash
   git commit -m "fix(backup): <one-line>"
   ```

- [ ] **Step 3：最终 squash 检查（可选）—— 只有用户要求才做**

如果用户希望把所有 backup commit 合成一个，使用 `git rebase -i HEAD~N`。默认保留细颗粒提交历史。

---

# 备注 / 依赖关系

- **Tasks 1-3** 必须先完成（其余所有任务都依赖 shared types / errors / IPC channels）。
- **Task 4-7** 内部线性依赖。
- **Task 8** 依赖 4-7。
- **Task 9-10** 依赖 8。
- **Task 11** 依赖 10。
- **Task 12-13** 依赖 11。
- **Phase 4** 依赖 Phase 3 完成（共享 store + section 已经存在）。
- **Phase 5** 依赖 Phase 4（buildRemote / loadRemoteConfig）。
- **Task 19** 中的 `BACKUP_REMOTE_NOT_CONFIGURED` 错误码必须存在于 Task 1（已在 Task 1 列表里）。
- 若某 Task 的代码与既有项目签名（如 `ListAssistant` 字段名）不符，按既有 type 定义为准修改 Task 内的代码，不要改既有 type。

# 已知妥协

- **WebDAV PROPFIND 解析** 用正则。一旦遇到偏离规范的服务器（特别是命名空间前缀奇怪的），可能漏识别——后续可换 `fast-xml-parser`。
- **`s3-lite-client` API 假设**：本计划写于库 v1 的接口约定。安装后若 `node_modules/s3-lite-client/dist/index.d.ts` 与 Task 16 中的方法名/参数不一致，按实际类型修改 Task 16 的 S3Remote 实现，不要修改其他 Task。
- **同步口令丢失**：用户清除 safeStorage（重装系统、删除用户配置目录）后，本机存的 `backup.syncPassphrase` 会丢，要求用户重新输入。这是设计选择（密钥永不离开设备）。
- **跨进程的 `ipcMain.handle` 包装**：Task 18 通过 monkey-patch `ipcMain.handle` 来植入 dirty-tracker。这要求 `installDirtyTracker()` 必须在所有 `register*Handlers()` 之前调用——已经按这个顺序写了。
