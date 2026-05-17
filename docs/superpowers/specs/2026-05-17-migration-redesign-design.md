# 迁移系统重设计

**日期**: 2026-05-17
**作者**: 与 Claude 协作
**状态**: 设计已定稿，待实施

## 背景与动机

当前迁移系统 (`src/main/migrate/`) 在每次应用启动时都会运行 `runMigrations()` —— 这会按顺序调用 8 个迁移函数。即使所有迁移早已应用完成，每个函数仍会执行一次自己的幂等检查（`PRAGMA table_info` / `getSetting('migrations.X') === '1'` 等）才能确认 "已做过、跳过"。

具体痛点：

1. **启动时无谓地跑代码**：已应用过的迁移仍要读 settings 表或 PRAGMA 才能 short-circuit。
2. **写新迁移繁琐**：每个新迁移都要自己挑一个独特的 setting key 当幂等门、自己写"是否已应用过"的检查逻辑。
3. **代码读起来复杂**：幂等门命名风格不统一（`migrations.X`、`builtins.X`、PRAGMA 列检查混用），迁移之间的依赖关系只在 `index.ts` 的注释里说明。

## 现状关键信息

应用尚未正式上线、没有真实用户在使用。这意味着**不存在"已部署的老库"需要兼容**：开发者本地的 `data/ai-studio.db` 可以直接删除重建。

这条前提把方案空间大幅简化 —— 不需要写"老库桥接 / bootstrap"逻辑、不需要保留现有 8 个迁移作为历史。

## 目标

- 启动时迁移开销趋近于 0（只有真有未应用的迁移时才做工作）。
- 写新迁移只需要写"如何变更"，不需要写幂等检查。
- 文件结构和约定简洁到几乎无可削减。
- 在 `CLAUDE.md` 中写清楚约定，让未来的迁移作者不会偏离。

## 设计

### 架构

只用 SQLite 内置的 `PRAGMA user_version`（一个 32 位整数，存在数据库文件头里）追踪"已应用到第几号迁移"。

所有逻辑放在**单个文件** `src/main/migrate/index.ts`，约 30 行代码：

```ts
import type Database from 'better-sqlite3'
import { getDb } from '../db/database'

interface Migration {
  version: number
  name: string
  up(db: Database.Database): void
}

const MIGRATIONS: Migration[] = []

export function runMigrations(): void {
  const db = getDb()
  const current = db.pragma('user_version', { simple: true }) as number
  for (const m of MIGRATIONS) {
    if (m.version <= current) continue
    db.transaction(() => {
      m.up(db)
      db.pragma(`user_version = ${m.version}`)
    })()
    console.log(`[migrate] applied ${m.version}-${m.name}`)
  }
}
```

启动时 `main/index.ts` 仍按原样调用 `runMigrations()`，调用时机不变（`initDatabase()` 之后立刻）。

### 行为规约

- **MIGRATIONS 数组**按 `version` 升序排列，元素从 `1` 开始递增。首次重构落地时数组为空。
- **每个迁移独立事务**：`up()` 和 `PRAGMA user_version = N` 在同一个 `db.transaction(...)` 里。失败时事务回滚 → `user_version` 不推进 → 下次启动会重试这个迁移。
- **失败抛出，不吞错**：迁移失败让 `runMigrations()` 抛错，由 `main/index.ts` 现有的启动错误处理路径接住（如果当前没有，本次实施时**不**主动新增 —— 不为想象中的未来抽象；让 Electron 默认行为生效，开发者从主进程 console / 终端能看到栈即可定位）。
- **空数组场景**：不输出任何日志；启动开销只是一次 `db.pragma('user_version')` 读取。
- **不引入** `down()`、不引入 async、不引入连续性校验、不拆子目录、不拆 types.ts —— 上述任意一项都是 YAGNI。等到真的需要时再加。

### 文件结构

```
src/main/migrate/
└── index.ts    # 唯一文件
```

未来增加第一个迁移时的演进：

```
src/main/migrate/
├── index.ts
└── 001-some-name.ts   # 在 index.ts 里 import 并 push 到 MIGRATIONS
```

当迁移多到一个 `index.ts` 不舒服时，再拆 `migrations/` 子目录。**不要现在就拆。**

### createTables / seed 的"压扁"

现有 8 个迁移代表"早期 schema + 数据 → 当前 schema + 数据"的路径。重构后这条路径不再存在，所以把它的终点直接写进 `src/main/db/database.ts` 的 `createTables()` 和 `src/main/db/seeds/` 中：

| 现有迁移                                    | 对 createTables / seed 的影响                                                                                                                                                                                                                      |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `migrate-backup-settings`                   | 无（纯 setting 数据迁移，新装库本就没有遗留 setting）                                                                                                                                                                                              |
| `migrate-assistant-library-fields`          | `assistants` 表 `CREATE TABLE` 直接含 6 列（`kind`、`category`、`recommended_model`、`source`、`is_builtin`、`source_template_id`）+ 2 个索引（`idx_assistants_kind`、`idx_assistants_category`）；`seedAssistantTemplates()` 由 seed 流程直接调用 |
| `cleanup-seed-i18n-keys`                    | 无（新 seed 文件本就用真实文本）                                                                                                                                                                                                                   |
| `init-builtin-applied-versions`             | `seedDatabaseDefaults` 设置 `builtins.templates.appliedVersion` / `builtins.quickActions.appliedVersion` / `builtins.selectionActions.appliedVersion` 三个初值                                                                                     |
| `promote-definition-groups-to-model-groups` | 无（前提：新 seed `model_groups` 已是 vendor-grained v2 格式 —— 实施时**验证**）                                                                                                                                                                   |
| `drop-model-definition-provider-types`      | `model_definitions` `CREATE TABLE` 不含 `provider_types` 列                                                                                                                                                                                        |
| `coalesce-model-groups-by-vendor`           | 无（同 promote 行）                                                                                                                                                                                                                                |
| `remove-qwen3-builtin`                      | 无（前提：新 seed `model_definitions` 不含 Qwen3 —— 实施时**验证**）                                                                                                                                                                               |

实施时必须验证的两处：

- `src/main/db/seeds/catalogs.ts` 的 `model_groups` / `model_definitions` seed 数据是否已是 v2 vendor 格式 + 不含 Qwen3。如果不是，先调整 seed。
- `seedDatabaseDefaults()`（由 `createTables()` 在新装库流程里调用）是否会触达 `seedAssistantTemplates()`。**当前现状**：原迁移文件 `assistant-library-fields.ts` 的注释解释了"seed 必须放在迁移里，因为新列在 createTables 之前不存在"。本次重构把列写进 CREATE TABLE 后，这个借口消失了 —— 应当把 `seedAssistantTemplates()` 调用从删除的迁移搬进 `seedDatabaseDefaults()` 链路。

### 删除清单

实施时删除以下文件：

- `src/main/migrate/index.ts`（原版，重写）
- `src/main/migrate/backup-settings.ts`
- `src/main/migrate/assistant-library-fields.ts`
- `src/main/migrate/cleanup-seed-i18n-keys.ts`
- `src/main/migrate/init-builtin-applied-versions.ts`
- `src/main/migrate/promote-definition-groups-to-model-groups.ts`
- `src/main/migrate/drop-model-definition-provider-types.ts`
- `src/main/migrate/coalesce-model-groups-by-vendor.ts`
- `src/main/migrate/remove-qwen3-builtin.ts`

并清扫这些迁移引入的旧 setting key 读取代码（如果有）：

- `backup.autoSyncIntervalMinutes` / `backup.maxRetainedBackups` / `backup.lastSyncedAt` / `backup.lastRemoteSeenAt` —— 现状已被 backup-settings 迁移搬到 per-remote key，新装库不会有这些。**实施时全仓库 grep 验证没人再读**。
- `migrations.definitionGroupsPromoted` / `migrations.modelGroupsCoalescedByVendor` / `migrations.qwen3BuiltinRemoved` / `builtins.i18nKeysCleanedUp` —— 这些是旧迁移自己的幂等门。**实施时全仓库 grep 验证只有被删除的迁移文件里有引用**。

### 开发者本地数据库重置

开发者本地若已存在 `data/ai-studio.db`，在升级到新代码后需要**手动删除**（重启应用即重建）。在 PR 描述里写明，不在代码里做"自动检测旧库"的逻辑（那等于又写了一遍 bootstrap）。

### CLAUDE.md 同步更新

`F:\work\ai-studio\CLAUDE.md` 的 **Key Conventions** 段里有一条 "Boot-time migrations"，原文：

> **Boot-time migrations**: any one-shot, idempotent data migration (settings reshape, schema fixups, file moves) lives in `src/main/migrate/`. Add a new file per migration and register it in `src/main/migrate/index.ts` `runMigrations()`. Migrations MUST be idempotent — they run on every boot.

实施时改写为：

> **Boot-time migrations**: 迁移机制基于 SQLite `PRAGMA user_version`，调度器在 `src/main/migrate/index.ts`。新增迁移：
>
> - 在 `src/main/migrate/` 下新建 `NNN-short-name.ts`（NNN 是下一个连续数字，从 001 起）。导出形如 `{ version: NNN, name: 'short-name', up(db) { ... } }` 的 `Migration` 对象。
> - 在 `index.ts` 顶部 import 并 `push` 到 `MIGRATIONS` 数组（保持数组按 `version` 升序）。
> - **不需要**在 `up()` 内部写幂等检查 —— 框架保证每个 version 只跑一次。
> - **不需要**手动开事务 —— 框架把 `up()` 和 `user_version` 推进包在同一事务里。
> - 一旦某个版本号发布到 git 主干，**永远不要修改它的 `up()`**（已经升级过的库不会再跑它）。要修改，新增一个更高 version 的迁移。
> - 迁移失败会抛出，让应用启动失败暴露问题，不要 try/catch 吞错。
>
> 此外把 schema 变更也优先考虑直接进 `database.ts` 的 `createTables()`（新装库直接拿到最终形态，迁移只服务于"已存在的库"）—— 但**不要**回头改 `createTables()` 在已发布版本之后的 schema，那会让新装库和老库分裂。

## 错误处理

- 迁移内部异常 → 事务回滚 → `user_version` 不变 → `runMigrations()` 重新抛出。
- `main/index.ts` 在 `app.whenReady().then(...)` 链上现有什么错误处理就走什么 —— 不在本次重构里新加。
- 启动期校验（version 连续 / 数组排序）**先不加**，等真有迁移再说。

## 测试

项目当前无测试基础设施。本次重构不引入。第一次真实迁移上线时再补 `runner` 的单元测试（mock 一个 db，验证 version 跳过、事务、推进）。

## 验收

- [ ] `src/main/migrate/` 只剩一个 `index.ts`，行数 < 50。
- [ ] `npm run typecheck` 通过。
- [ ] 开发者删除 `data/ai-studio.db` 后启动应用，能正常进入主界面、能新建对话、能进入设置看到内置助手 / quick actions / selection actions / model groups / model definitions（说明 seed 数据完整）。
- [ ] `CLAUDE.md` 的 "Boot-time migrations" 段已按上述改写。
- [ ] 全仓库 grep `migrations.definitionGroupsPromoted` / `builtins.i18nKeysCleanedUp` / `migrations.qwen3BuiltinRemoved` / `migrations.modelGroupsCoalescedByVendor` 不再有引用（除了 git history）。

## 非目标 / 不做的事

- 不写 `bootstrap-from-legacy` 逻辑。
- 不写 `down()` / rollback。
- 不引入 async migration。
- 不引入版本号连续性校验。
- 不引入新的测试基础设施。
- 不为旧 `data/ai-studio.db` 做自动检测与转换 —— 开发者手动删。
