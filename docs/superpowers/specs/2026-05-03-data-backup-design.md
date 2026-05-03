# 数据备份与云端同步 — 设计文档

- 日期：2026-05-03
- 范围：AI Studio（Electron + React）新增"数据备份"功能：本地导出/导入 + 可选的云端同步
- 状态：设计稿，待实现

## 1. 目标与非目标

### 目标

- 用户可以**本地导出**应用的全部"配置类"数据为单一文件，并能在另一台机器上**导入**还原。
- 用户可以**配置一个云端后端（WebDAV 或 S3 兼容）**，在多台设备之间通过云端同步配置。
- 同步可由用户**手动触发**，也可按用户配置的**固定间隔**自动触发。
- 备份文件**强制**用用户口令加密；API Key 与其他敏感字段在备份中以加密形式存在。
- 用户可以配置云端**最大保留备份数**，老备份自动清理。

### 非目标

- 不导出 / 同步聊天记录（`conversations` / `messages`）。
- 不导出翻译历史（`translation_history`）与消息附件（`attachments`）。
- 不做按行级时间戳的双向合并；冲突仅按"最新者覆盖（LWW）"语义解决。
- 不做基于 Git 的版本控制式同步；仅按"快照"维度保存与覆盖。
- 不引入测试基础设施。

## 2. 范围：哪些数据进备份

### 进备份

- `settings` 表全部 key/value（含主题、缩放、快捷键、快捷助手/划词助手设置、网络设置等）
- `providers` + 关联 `models`
- `model_definitions` / `model_groups`
- `assistants`
- `phrases`
- `quick_actions`
- `selection_actions`
- `data/avatars/` 下的用户头像图片（base64 内嵌进备份）

### 不进备份

- `conversations` / `messages` / `translation_history`
- `data/attachments/` 下的消息附件
- 自动维护的时间戳列（`created_at` / `updated_at`）—— 导入后由数据库重新生成

### 敏感字段处理

- `providers.api_key` 与 `settings` 中所有 `*.apiKey`：在 main 进程中先用 `safeStorage` 解密为明文，写入备份的明文 snapshot，然后整体由用户口令通过 AES-256-GCM 加密成密文 payload。
- 导入时反向：用口令解密 → 拿到明文 snapshot → 用本机 `safeStorage` 重新加密敏感字段 → 写回 DB。
- 这一"解密 → re-encrypt"模式保证密钥永不离开设备，备份文件的安全完全由用户口令决定。

## 3. 文件格式

`.aibackup` 是一个 JSON 文本文件，最外层为明文头，内部 `payload` 是加密后的 base64：

```json
{
  "magic": "AISTUDIO-BACKUP",
  "schemaVersion": 1,
  "appVersion": "x.y.z",
  "createdAt": "2026-05-03T12:34:56.789Z",
  "encryption": {
    "algo": "AES-256-GCM",
    "kdf": "PBKDF2-SHA256",
    "iterations": 200000,
    "salt": "<base64, 16B>",
    "iv": "<base64, 12B>"
  },
  "payload": "<base64 ciphertext>",
  "tag": "<base64, GCM auth tag, 16B>"
}
```

### 设计要点

- **明文头**让运维/排查时也能看到 `schemaVersion` / `appVersion`，并通过 `magic` 在解密前判断文件类型。
- **PBKDF2-SHA256(口令, salt, 200_000)** 派生 32 字节主密钥；**AES-256-GCM** 一次性加密整个 snapshot。GCM 自带认证 tag——口令错或文件被篡改都会在 `decipher.final()` 抛错。
- **零新加密依赖**——直接用 Node 内建 `crypto`。
- **schemaVersion** 当前 = 1。未来如果备份结构发生破坏性变化才递增；导入时若读到比本程序支持的版本更高的 schema，提示用户升级应用。

### 解密后的 snapshot 结构

```ts
interface BackupSnapshot {
  schemaVersion: 1
  exportedAt: string
  app: { version: string }
  settings: Record<string, string> // 已解密的明文设置
  providers: Provider[] // apiKey 字段已解密
  models: Model[]
  modelDefinitions: ModelDefinition[]
  modelGroups: ModelGroup[]
  assistants: Assistant[]
  phrases: Phrase[]
  quickActions: QuickAction[]
  selectionActions: SelectionAction[]
  avatars: { fileName: string; mimeType: string; data: string /* base64 */ }[]
}
```

## 4. 架构与模块

```
src/main/backup/
├── index.ts                  # 对外门面：exportToFile / importFromFile / syncNow / scheduleAuto
├── snapshot.ts               # collectSnapshot() / applySnapshot(snapshot, mode)
├── crypto.ts                 # PBKDF2 派生 + AES-256-GCM 加解密（Node crypto）
├── codec.ts                  # encodeBackupFile / decodeBackupFile（含 magic / schemaVersion 校验）
├── remote/
│   ├── types.ts              # BackupRemote 接口
│   ├── webdav.ts             # WebDAV 实现（fetch + Basic Auth + PROPFIND XML）
│   └── s3.ts                 # S3 兼容（s3-lite-client）
├── sync-service.ts           # BackupSyncService 单例：定时器、互斥锁、LWW、回滚副本、清理
└── dirty-tracker.ts          # 写型 IPC handler 包装层，更新 backup.lastLocalChangeAt

src/main/ipc/backup-handlers.ts   # 注册所有 backup:* 通道
src/shared/ipc-channels.ts        # 增加 backup 域常量
src/shared/types.ts               # BackupSnapshot / BackupMeta / RemoteConfig / SyncStatus / SyncResult
src/shared/errors.ts              # 增加 BACKUP_* 错误码
src/preload/index.ts              # 暴露 window.api.backup.*

src/renderer/src/components/settings/sections/BackupSection.tsx
src/renderer/src/components/settings/dialogs/BackupRemoteDialog.tsx
src/renderer/src/components/settings/dialogs/BackupHistoryDialog.tsx
src/renderer/src/stores/backupStore.ts
```

### 关键决定理由

- 所有加密、远端 IO、DB 读写都在 main 进程，沿用项目 "AI 调用 / DB 访问只在 main" 的既有约定。
- `BackupRemote` 是窄接口（5 个方法），把传输层细节封掉；将来加 GitHub/HTTP 端点零成本，且方便从 `s3-lite-client` 切换到 `@aws-sdk/client-s3`。
- `dirty-tracker` 用 IPC 包装层而不是散布 `markDirty()` 到每个 db 文件，保持业务代码干净。
- v1 用 `s3-lite-client`（~100 KB、零依赖、原生支持 S3 兼容）。如未来需要预签名 URL 等高级特性再切官方 SDK——`BackupRemote` 接口已隔离这一变更。

### `BackupRemote` 接口

```ts
interface BackupRemote {
  put(path: string, bytes: Uint8Array): Promise<void>
  get(path: string): Promise<Uint8Array>
  list(prefix: string): Promise<RemoteObject[]> // { key, size, lastModified }
  delete(path: string): Promise<void>
  headLastModified(path: string): Promise<string | null> // ISO，用于读 manifest 元信息
}
```

### `RemoteConfig` 形态

```ts
type RemoteConfig =
  | { type: 'webdav'; url: string; username: string; password: string; subPath: string }
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
```

口令字段（`password` / `secretAccessKey` / `backup.syncPassphrase`）落 `settings` 表时走项目已有的 `safeStorage` 加密——把这些 key 加进 `settings.ts` 的 `SENSITIVE_KEYS` 集合即可。

## 5. 同步引擎与冲突策略

### 三个时间戳（写入 `settings` 表，统一前缀 `backup.*`）

| key                        | 含义                                       | 谁写它                                    |
| -------------------------- | ------------------------------------------ | ----------------------------------------- |
| `backup.lastLocalChangeAt` | 最近一次"配置类数据"被本地修改的时间       | `dirty-tracker` 在每次写敏感表/设置后更新 |
| `backup.lastSyncedAt`      | 最近一次本机与云端达成一致的时间           | `BackupSyncService` 上传/下载成功后更新   |
| `backup.lastRemoteSeenAt`  | 最近一次从云端读到的最新备份的 `createdAt` | 同上                                      |

### dirty-tracker 实现

不在每个 `db/*.ts` 中散布 `markDirty()`——在 `src/main/ipc/index.ts` 注册 IPC handler 时套一层 wrapper：

```ts
const TRACKED_DOMAINS = new Set([
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
const TRACKED_VERBS = new Set(['create', 'update', 'delete', 'reorder', 'set', 'set-batch'])
```

匹配的 channel 在 result 返回前调用 `markDirty()`（更新 `backup.lastLocalChangeAt`）。

### 远端 layout

```
<root>/
├── manifest.json                             # { latestBackupKey, latestCreatedAt, schemaVersion }
└── backups/
    ├── 2026-05-03T12-34-56-789Z.aibackup
    ├── 2026-05-02T08-00-00-000Z.aibackup
    └── ...
```

### syncNow() 单次执行流程

1. 拿互斥锁（`isSyncing` + 排队 promise）；并发触发的第二个抛 `BACKUP_BUSY`。
2. `remote.get('manifest.json')`：
   - 失败为 not-found → 视为首次，转分支 _上传_。
   - 网络/认证错 → 抛 `BACKUP_REMOTE_*`，不再继续。
   - 成功 → 解析出远端 `latestCreatedAt`。
3. LWW 决策——比较两个时间戳：
   - `local = backup.lastLocalChangeAt`（dirty-tracker 维护）
   - `remote = latestCreatedAt`（远端 manifest）
   - **`local > remote + 1s`** → 上传当前快照。
   - **`remote > local + 1s`** → 下载并应用（apply 前先存本地回滚副本）。
   - **`|local - remote| ≤ 1s`** → 无操作（容忍时钟漂移），仅刷新 `lastSyncedAt`。
   - 边界：本地 `lastLocalChangeAt` 缺失（全新装机首次同步）→ 强制走 _下载_ 分支；远端 manifest 缺失 → 强制走 _上传_ 分支。
4. 上传分支结束后调用 `remote.list('backups/')`，按 `createdAt` 降序保留前 N 份（N = `backup.maxRetainedBackups`），其余 `remote.delete()`。
5. **manifest 最后更新**：上传完成后**最后一步**才 `remote.put('manifest.json', ...)`——保证崩溃时 manifest 仍指向旧文件，新备份变成"孤儿"由下次 list 清理。
6. 全部成功 → 更新三个时间戳并推送 `backup:status-changed`。

### 取消

- `BackupSyncService` 内部持一个 `AbortController`；`backup:sync-cancel` 调用 `abort()`。
- 与项目现有 `chat-handlers` / `quick-assistant-handlers` 的 abort 模式保持一致。
- 取消视为正常返回（`{ direction: 'cancelled' }`），不进 `IpcResult.error`。

### 自动同步定时器

- 设置项 `backup.autoSyncIntervalMinutes`（0 = 关闭、≥5 才生效；默认 0）。
- service 在启动时和设置变更时重置定时器；应用未启动期间不补跑。
- 定时器触发的失败**不弹窗**——只更新 `status.lastError`，UI 在备份卡片角标显示红点；用户主动触发的 `syncNow()` 失败才弹 toast。

### 多设备语义

LWW 是"两台设备共用同一个 bucket / WebDAV 路径"的简单冲突解决——离线设备上线后，本地改动可能被云端覆盖。**回滚副本**是为这种情况兜底：用户能在本地 `data/backups/auto-rollback/` 找到 apply 前的本地状态。

## 6. IPC 通道

新增一个 `backup` 域，加进 `src/shared/ipc-channels.ts` 的 `IpcChannels`。

| 通道                         | 类型   | 入参                                                                  | 返回 / 推送                                                                                             |
| ---------------------------- | ------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `backup:export-to-file`      | invoke | `{ password: string }`                                                | `IpcResult<{ filePath: string }>`（用 `dialog.showSaveDialog`）                                         |
| `backup:import-from-file`    | invoke | `{ filePath?: string; password: string; mode: 'replace' \| 'merge' }` | `IpcResult<{ applied: BackupSummary }>`                                                                 |
| `backup:peek-file`           | invoke | `{ filePath: string }`                                                | `IpcResult<{ schemaVersion, appVersion, createdAt }>`（不解密）                                         |
| `backup:get-remote-config`   | invoke | —                                                                     | `IpcResult<RemoteConfig \| null>`                                                                       |
| `backup:set-remote-config`   | invoke | `RemoteConfig`                                                        | `IpcResult<void>`                                                                                       |
| `backup:test-remote`         | invoke | `RemoteConfig`                                                        | `IpcResult<{ ok: boolean; latency?: number }>`（PUT/GET 探针）                                          |
| `backup:sync-now`            | invoke | —                                                                     | `IpcResult<SyncResult>`                                                                                 |
| `backup:sync-cancel`         | invoke | —                                                                     | `IpcResult<void>`                                                                                       |
| `backup:list-remote`         | invoke | —                                                                     | `IpcResult<RemoteBackupItem[]>`                                                                         |
| `backup:restore-from-remote` | invoke | `{ key: string; mode: 'replace' \| 'merge' }`                         | `IpcResult<void>`                                                                                       |
| `backup:get-status`          | invoke | —                                                                     | `IpcResult<SyncStatus>`                                                                                 |
| `backup:status-changed`      | push   | —                                                                     | `SyncStatus`                                                                                            |
| `backup:progress`            | push   | —                                                                     | `{ phase: 'collect' \| 'encrypt' \| 'upload' \| 'download' \| 'decrypt' \| 'apply'; percent?: number }` |

### preload

`window.api.backup.*` 一一对应（驼峰化）。沿用项目既有的"只暴露 typed 包装函数"约定。

### 类型定义（加到 `src/shared/types.ts`）

```ts
interface SyncStatus {
  isSyncing: boolean
  lastLocalChangeAt: string | null
  lastSyncedAt: string | null
  lastRemoteSeenAt: string | null
  lastError: LocalizedError | null
  lastWarning: string | null
  hasRemoteConfigured: boolean
  autoSyncIntervalMinutes: number
}

interface SyncResult {
  direction: 'upload' | 'download' | 'noop' | 'cancelled'
  createdAt?: string
}

interface BackupSummary {
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

interface RemoteBackupItem {
  key: string
  size: number
  lastModified: string
  createdAt: string
  appVersion: string
}
```

## 7. 渲染端 UI

新增一个 Settings 子页：`Settings → 数据备份 (Backup)`，加进 `SettingsPage` 与 `PrimaryNav` 的设置入口列表，紧跟在"数据管理 (Data)"之后。

### 页面布局

```
┌─ 本地备份 ──────────────────────────────────────┐
│  [ 导出到文件… ]   [ 从文件导入… ]                │
│  导入模式：◉ 替换  ○ 合并                        │
│                                                   │
│  导出/导入会要求输入口令；口令仅用于加密备份文件。 │
└───────────────────────────────────────────────────┘

┌─ 云端同步 ──────────────────────────────────────┐
│  状态：● 已配置 (WebDAV)        [ 测试连接 ]      │
│        最后同步：2026-05-03 12:34                │
│        最后本地变更：2026-05-03 12:30             │
│                                                   │
│  [ 立即上传 ]  [ 立即下载并应用 ]  [ 立即同步 ]   │
│                                                   │
│  自动同步间隔：[ 关闭 ▾ ]                         │
│  最大保留备份数：[ 5  ▾ ]   (1–50)                │
│                                                   │
│  [ 配置远端… ]   [ 历史版本… ]   [ 清除配置 ]      │
└───────────────────────────────────────────────────┘
```

### 关键交互

- **配置远端**：`BackupRemoteDialog` 顶部 Tab 切 WebDAV / S3；底部"测试并保存"按钮——只有连通才允许保存。S3 Tab 默认 `forcePathStyle = true`，加一个"我的服务商需要关掉它"开关。
- **历史版本**：`BackupHistoryDialog` 列出 `backup:list-remote` 的结果（key / createdAt / appVersion / 大小），单条上的"恢复"按钮先要口令再要模式选择。
- **导入对话框**：文件名以 `.aibackup` 结尾时先调 `backup:peek-file` 显示元信息再要密码，避免用户输入密码后才发现选错文件。
- **进度条**：长操作期间订阅 `backup:progress`，用 `Sonner` toast 或一个轻量横向进度条。
- **状态实时刷新**：`BackupSection` mount 时订阅 `backup:status-changed`，更新 `backupStore` 中的 `SyncStatus`。

### 新 store

`src/renderer/src/stores/backupStore.ts`，Zustand：

```ts
interface BackupStore {
  status: SyncStatus | null
  remoteConfig: RemoteConfig | null
  loadStatus: () => Promise<void>
  loadRemoteConfig: () => Promise<void>
  syncNow: () => Promise<SyncResult>
  cancelSync: () => Promise<void>
  exportToFile: (password: string) => Promise<string>
  importFromFile: (filePath: string, password: string, mode: 'replace' | 'merge') => Promise<void>
  setRemoteConfig: (cfg: RemoteConfig) => Promise<void>
  testRemote: (cfg: RemoteConfig) => Promise<boolean>
}
```

### i18n

新增 `settings.backup.*` 命名空间到 `src/renderer/src/i18n/locales/{en,zh-CN}.json`。

## 8. 错误处理与回滚

沿用项目现有 `AppError` + `LocalizedError` + `ERROR_CODES` 模型。新增以下错误码到 `src/shared/errors.ts`：

| 错误码                    | 触发场景                                                           |
| ------------------------- | ------------------------------------------------------------------ |
| `BACKUP_FILE_INVALID`     | `magic` 头不匹配、JSON 损坏、`schemaVersion` 不被支持              |
| `BACKUP_PASSWORD_WRONG`   | AES-GCM `final()` 抛 auth-tag 错（同时覆盖"口令错"和"文件被篡改"） |
| `BACKUP_SCHEMA_TOO_NEW`   | 备份是更高 schemaVersion——独立提示让用户升级应用                   |
| `BACKUP_REMOTE_AUTH`      | WebDAV 401/403、S3 SignatureDoesNotMatch / InvalidAccessKeyId      |
| `BACKUP_REMOTE_NOT_FOUND` | 远端目标 bucket / 路径不存在                                       |
| `BACKUP_REMOTE_NETWORK`   | 超时 / DNS / TLS 失败——可重试场景                                  |
| `BACKUP_REMOTE_FORBIDDEN` | 已认证但权限不够                                                   |
| `BACKUP_BUSY`             | 并发触发，已有同步在跑                                             |
| `BACKUP_CANCELLED`        | 用户主动取消（仅用于内部信号；对外 resolve 而非 reject）           |
| `BACKUP_APPLY_FAILED`     | 导入回写 DB 阶段失败                                               |

每个码都加 i18n 文案到两份 locale。

### 回滚机制

**关键不变量：apply 失败时 DB 必须保持原状。**

1. **拉取/解密阶段失败**：DB 完全没动——直接抛错给上层。
2. **apply 阶段**（最危险）：
   - **首选**：把整个 `applySnapshot()` 包在一个 better-sqlite3 `db.transaction(() => {...})()` 里——事务原子地 rollback。
   - **avatars 文件**：写到 `data/avatars/.tmp-<uuid>/` 临时目录；事务提交后再 `rename` 进 `data/avatars/`；事务回滚时 `rm -rf` 临时目录。
   - **第二保险**：apply 前自动调一次 `collectSnapshot()` 写到 `data/backups/auto-rollback/pre-apply-<isoDate>.aibackup`；定时同步场景下用保存在 `safeStorage` 的同步口令加密。
3. **远端清理失败**：永远不阻断主流程；只在 `backup:status-changed` 推送的 `lastWarning` 字段中带出。

### IPC handler 包装

每个 `backup:*` handler 用项目既有的 `wrapIpc(handler)` 模式（参考 `provider-handlers.ts`）：抛 `AppError` 自动转成 `IpcResult { success: false, error: LocalizedError }`。

## 9. 设置项汇总

新增的 settings keys（统一前缀 `backup.*`）：

| key                              | 类型                   | 默认        | 说明                                               |
| -------------------------------- | ---------------------- | ----------- | -------------------------------------------------- |
| `backup.lastLocalChangeAt`       | ISO string             | —           | dirty-tracker 维护                                 |
| `backup.lastSyncedAt`            | ISO string             | —           | 同步引擎维护                                       |
| `backup.lastRemoteSeenAt`        | ISO string             | —           | 同步引擎维护                                       |
| `backup.autoSyncIntervalMinutes` | int                    | `0`         | 0=关闭，≥5 生效                                    |
| `backup.maxRetainedBackups`      | int                    | `5`         | 1–50                                               |
| `backup.defaultImportMode`       | `'replace' \| 'merge'` | `'replace'` | UI 默认值                                          |
| `backup.remote.type`             | `'webdav' \| 's3'`     | —           | 已配置时存在                                       |
| `backup.remote.config`           | JSON string            | —           | 不含口令字段                                       |
| `backup.remote.password`         | string（safeStorage）  | —           | WebDAV password                                    |
| `backup.remote.secretAccessKey`  | string（safeStorage）  | —           | S3 secret                                          |
| `backup.syncPassphrase`          | string（safeStorage）  | —           | 自动同步用的加密口令；首次启用云端同步时让用户设置 |

`backup.remote.password` / `backup.remote.secretAccessKey` / `backup.syncPassphrase` 加进 `src/main/db/settings.ts` 的 `SENSITIVE_KEYS` 集合即可享用现有 safeStorage 机制。

## 10. 数据流摘要

### 导出到文件

```
UI 输入口令 → backup:export-to-file
  → snapshot.collectSnapshot()    [main]
  → crypto.encrypt(snapshot, 口令)
  → codec.encodeBackupFile(...)
  → dialog.showSaveDialog()
  → fs.writeFile(...)
```

### 从文件导入

```
UI 选文件 → backup:peek-file（显示元信息）
UI 输入口令 + 模式 → backup:import-from-file
  → fs.readFile(...)
  → codec.decodeBackupFile(...)
  → crypto.decrypt(payload, 口令)
  → snapshot.applySnapshot(snapshot, mode)   [事务 + avatars rename]
```

### 立即同步

```
UI 按"立即同步" → backup:sync-now
  → BackupSyncService.syncNow()
    → remote.get('manifest.json')
    → 比较时间戳，分支：
       upload   → encrypt + put backup → put manifest → cleanup old
       download → get backup → 写本地回滚副本 → decrypt → applySnapshot(replace)
       noop     → 仅更新 lastSyncedAt
  → settings.set(backup.lastSyncedAt, ...)
  → emit backup:status-changed
```
