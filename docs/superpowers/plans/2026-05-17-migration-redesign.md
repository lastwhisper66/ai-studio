# 迁移系统重设计 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把现有的"每次启动跑 8 个内含幂等门的迁移函数"改成"基于 SQLite `PRAGMA user_version` 的极简调度器 + 空迁移数组"，并把现有 8 个迁移的终态固化到 schema / seed 中。

**Architecture:** `src/main/migrate/index.ts` 单文件、约 30 行；`MIGRATIONS` 数组首次落地为空；启动期只读一次 `PRAGMA user_version`。schema 终态已经在 `createTables()` 里就位，本次仅在 `seedDatabaseDefaults()` 里补一处 `seedAssistantTemplates()`。

**Tech Stack:** Electron 主进程、TypeScript、better-sqlite3。无测试基础设施（规格明确不引入）。

**规格**: `docs/superpowers/specs/2026-05-17-migration-redesign-design.md` (commit `5fa6581`)

**前置确认 (实施前已经完成的调研)：**

- `createTables()` 已含 assistants 6 列（`kind / category / recommended_model / source / is_builtin / source_template_id`）+ `idx_assistants_kind` + `idx_assistants_category`。`model_definitions` 已无 `provider_types` 列。
- `seed-model-groups.json` 是 v2 vendor 格式；`seed-model-definitions.json` 不含 Qwen3。
- `seedAssistantTemplates()` 位于 `src/main/db/templates.ts:275`，自带 `templates.builtinsSeeded` 幂等门，可安全直接调用。
- `builtins-handlers.ts:16-21` 的 `readAppliedVersion(key, fallback)` 在 setting 缺失时回退到当前源码版本号 ⇒ 新装库无需 seed 这三个 setting（`hasUpdate` 自然为 false）。规格表中 `init-builtin-applied-versions` 行的实际工作量是 0。
- 旧 setting key（`backup.autoSyncIntervalMinutes` 等 + `migrations.X` 系列 + `builtins.i18nKeysCleanedUp`）经全仓库 grep，**业务代码无读取**，只在被删除的迁移文件 + 两处普通注释里出现。

---

## Task 1: 在 seedDatabaseDefaults 里接入 seedAssistantTemplates

**Why first**: 这一步独立于框架改造、独立于删除迁移文件 — 可单独 commit。改完后新装库的 assistant templates 由 seed 流程负责，不再依赖 assistant-library-fields 迁移调它。

**Files:**

- Modify: `src/main/db/seeds/index.ts` (整文件 15 行)

- [ ] **Step 1: 修改 `src/main/db/seeds/index.ts`**

把现有 `src/main/db/seeds/index.ts` 整体替换为：

```ts
import { seedDefaultAssistant } from '../assistants'
import { seedAssistantTemplates } from '../templates'
import { seedModelDefinitions } from '../model-definitions'
import { seedModelGroups } from '../model-groups'
import { seedDefaultProviders } from '../providers'
import { seedQuickActions } from '../quick-actions'
import { seedSelectionActions } from '../selection-actions'

export function seedDatabaseDefaults(): void {
  seedDefaultAssistant()
  seedAssistantTemplates()
  seedModelDefinitions()
  seedModelGroups()
  seedDefaultProviders()
  seedQuickActions()
  seedSelectionActions()
}
```

变更点：第 2 行新增 `seedAssistantTemplates` import；`seedDatabaseDefaults` 函数体第二行新增 `seedAssistantTemplates()` 调用（紧跟 `seedDefaultAssistant()` 之后，与"先种默认 assistant、再种 templates"的语义顺序一致）。

- [ ] **Step 2: 验证 typecheck 通过**

Run:

```
npm run typecheck
```

Expected: 两个子检查（typecheck:node、typecheck:web）全部通过，无错误。

- [ ] **Step 3: 手动验证 seed 流程不会重复执行**

`seedAssistantTemplates()` 内部已经有 `if (getSetting('templates.builtinsSeeded') === '1') return` 幂等门。即使本步骤之后老迁移 `assistant-library-fields.ts` 仍在运行（也会调一遍 `seedAssistantTemplates()`），第二次调用是 no-op。可以肉眼确认这一点：

Read `src/main/db/templates.ts` 第 275-279 行（确认 `if (getSetting('templates.builtinsSeeded') === '1') return` 仍在）。

预期：确认到位即可，无需修改任何内容。

- [ ] **Step 4: 单独 commit**

```
git add src/main/db/seeds/index.ts
git commit -m "feat(db): seed assistant templates in seedDatabaseDefaults

把 seedAssistantTemplates 从 assistant-library-fields 迁移搬进 seed 主流程。
新装库直接由 seed 流程种入 templates。seedAssistantTemplates 自带 templates.builtinsSeeded 幂等门，不会重复执行。

这是迁移系统重设计的前置步骤（spec: 2026-05-17）。"
```

---

## Task 2: 重写 src/main/migrate/index.ts 为 PRAGMA user_version 调度器

**Why now**: Task 1 commit 后，seed 主流程已自给自足。本任务把迁移调度器换掉、不再调用任何旧迁移函数。完成后 8 个旧文件成为死代码，由 Task 3 删除。

**Files:**

- Modify: `src/main/migrate/index.ts` (整文件重写)

- [ ] **Step 1: 整体替换 `src/main/migrate/index.ts`**

把现有 `src/main/migrate/index.ts`（含 44 行的旧版 runMigrations）整体替换为：

```ts
/**
 * 启动期数据库迁移。
 *
 * 机制：用 SQLite 内置的 `PRAGMA user_version` 追踪"已应用到第几号迁移"。
 * 每个迁移只跑一次；启动开销趋近于 0。
 *
 * 新增迁移的步骤参见 CLAUDE.md → Key Conventions → "Boot-time migrations"。
 */

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

变更点：删除所有旧 import 与函数命名导出；新文件不再 `import { migrateBackupSettings } ... from './backup-settings'` 等；不再有名为 `migrateBackupSettings`、`migrateAssistantLibraryFields` 等的具名 export。

注意：`src/main/index.ts:13` 形如 `import { runMigrations } from './migrate'` —— 这个 import 仍然有效（`runMigrations` 仍然导出）。无需改 `main/index.ts`。

- [ ] **Step 2: 验证 typecheck 通过**

Run:

```
npm run typecheck
```

Expected: 两个子检查全部通过。旧 8 个迁移文件此时已成为死代码（不再被任何 import 引用）但仍是合法 TypeScript，typecheck 仍会通过。下一任务直接删除它们。

---

## Task 3: 删除 8 个旧迁移文件

**Files:**

- Delete: `src/main/migrate/backup-settings.ts`
- Delete: `src/main/migrate/assistant-library-fields.ts`
- Delete: `src/main/migrate/cleanup-seed-i18n-keys.ts`
- Delete: `src/main/migrate/init-builtin-applied-versions.ts`
- Delete: `src/main/migrate/promote-definition-groups-to-model-groups.ts`
- Delete: `src/main/migrate/drop-model-definition-provider-types.ts`
- Delete: `src/main/migrate/coalesce-model-groups-by-vendor.ts`
- Delete: `src/main/migrate/remove-qwen3-builtin.ts`

- [ ] **Step 1: 用 `git rm` 删除 8 个文件**

Run（一次性 8 条 git rm，可在一行内）：

```
git rm src/main/migrate/backup-settings.ts src/main/migrate/assistant-library-fields.ts src/main/migrate/cleanup-seed-i18n-keys.ts src/main/migrate/init-builtin-applied-versions.ts src/main/migrate/promote-definition-groups-to-model-groups.ts src/main/migrate/drop-model-definition-provider-types.ts src/main/migrate/coalesce-model-groups-by-vendor.ts src/main/migrate/remove-qwen3-builtin.ts
```

Expected: 8 行 `rm ...` 输出，无错误。

- [ ] **Step 2: 验证目录只剩 index.ts**

Run:

```
ls src/main/migrate/
```

Expected: 只输出 `index.ts`（无其他文件）。

- [ ] **Step 3: 验证 typecheck 通过**

Run:

```
npm run typecheck
```

Expected: 两个子检查全部通过、无错误。

- [ ] **Step 4: 验证全仓库无旧 setting key 引用**

Run（在仓库根）：

```
grep -rn "migrations.definitionGroupsPromoted\|builtins.i18nKeysCleanedUp\|migrations.qwen3BuiltinRemoved\|migrations.modelGroupsCoalescedByVendor" src/
```

Expected: 无任何匹配（命令静默退出）。

Run:

```
grep -rn "backup.autoSyncIntervalMinutes\|backup.maxRetainedBackups" src/
```

Expected: 无任何匹配（命令静默退出）。

Run:

```
grep -rn "backup.lastSyncedAt\|backup.lastRemoteSeenAt" src/
```

Expected: **可能**还有一处匹配 —— `src/main/backup/dirty-tracker.ts:42` 的注释字面引用了旧 key。**继续到 Task 4 修正这条注释**（如果没有这处匹配，跳过 Task 4）。

---

## Task 4: 修正 backup/dirty-tracker.ts 注释里的旧 key 引用（如有）

**只有 Task 3 Step 4 第三个 grep 命中时执行本任务**。

**Files:**

- Modify: `src/main/backup/dirty-tracker.ts:40-42`（注释）

- [ ] **Step 1: 读出当前注释**

Read `src/main/backup/dirty-tracker.ts` 行 35-50，确认注释原文形如：

```ts
// Don't mark dirty for our own backup.* settings changes — would
// cause loops once Phase 5's sync-service starts writing
// backup.lastSyncedAt / backup.lastRemoteSeenAt back to settings.
```

- [ ] **Step 2: 修正注释里的 key 名**

把上面注释的第三行替换为：

```ts
// backup.remote.*.lastSyncedAt / backup.remote.*.lastRemoteSeenAt back to settings.
```

完整三行注释最终形态：

```ts
// Don't mark dirty for our own backup.* settings changes — would
// cause loops once Phase 5's sync-service starts writing
// backup.remote.*.lastSyncedAt / backup.remote.*.lastRemoteSeenAt back to settings.
```

- [ ] **Step 3: 重跑 grep 确认无残留**

Run:

```
grep -rn "backup.lastSyncedAt\|backup.lastRemoteSeenAt" src/
```

Expected: 无任何匹配。

---

## Task 5: 更新 CLAUDE.md 的 Boot-time migrations 段落

**Files:**

- Modify: `CLAUDE.md:296`（一行替换为多行）

- [ ] **Step 1: 替换 `CLAUDE.md:296` 那一行**

把 `CLAUDE.md` 第 296 行（**仅这一行**，整行替换）：

```
- **Boot-time migrations**: any one-shot, idempotent data migration (settings reshape, schema fixups, file moves) lives in `src/main/migrate/`. Add a new file per migration and register it in `src/main/migrate/index.ts` `runMigrations()`. Migrations MUST be idempotent — they run on every boot.
```

替换为：

```
- **Boot-time migrations**: 迁移机制基于 SQLite `PRAGMA user_version`，调度器在 `src/main/migrate/index.ts`。新增迁移：
  - 在 `src/main/migrate/` 下新建 `NNN-short-name.ts`（NNN 是下一个连续数字，从 001 起）。导出形如 `{ version: NNN, name: 'short-name', up(db) { ... } }` 的 `Migration` 对象。
  - 在 `index.ts` 顶部 import 并 `push` 到 `MIGRATIONS` 数组（保持数组按 `version` 升序）。
  - **不需要**在 `up()` 内部写幂等检查 —— 框架保证每个 version 只跑一次。
  - **不需要**手动开事务 —— 框架把 `up()` 和 `user_version` 推进包在同一事务里。
  - 一旦某个版本号发布到 git 主干，**永远不要修改它的 `up()`**（已经升级过的库不会再跑它）。要修改，新增一个更高 version 的迁移。
  - 迁移失败会抛出，让应用启动失败暴露问题，不要 try/catch 吞错。
  - 此外把 schema 变更也优先考虑直接进 `database.ts` 的 `createTables()`（新装库直接拿到最终形态，迁移只服务于"已存在的库"）—— 但**不要**回头改 `createTables()` 在已发布版本之后的 schema，那会让新装库和老库分裂。
```

注意缩进：原文是单行的 `-` 项，新版是该项 + 一组缩进 2 空格的子项 `-`。子项与父项的 markdown 结构保持成立。

- [ ] **Step 2: 验证替换位置正确**

Run:

```
grep -n "Boot-time migrations" CLAUDE.md
```

Expected: 输出恰好一行（仍是第 296 行附近），形如 `296:- **Boot-time migrations**: 迁移机制基于 SQLite ...`。

---

## Task 6: 整体验证

**Files:** 无修改，仅运行验证命令。

- [ ] **Step 1: typecheck**

Run:

```
npm run typecheck
```

Expected: 通过、无错误。

- [ ] **Step 2: lint**

Run:

```
npm run lint
```

Expected: 通过、无错误。

- [ ] **Step 3: format（如有任何格式化变化）**

Run:

```
npm run format
```

Expected: 无变化，或仅有非本次改动产生的无关变化。如果有本次改动相关的 prettier 格式化，把变化加入 stage（后续 commit 一并带上）。

- [ ] **Step 4: 验收清单确认**

逐条对比规格 §"验收"：

- [ ] `src/main/migrate/` 只剩一个 `index.ts`，行数 < 50。运行 `wc -l src/main/migrate/index.ts` 确认行数。
- [ ] `npm run typecheck` 通过（Step 1）。
- [ ] `CLAUDE.md` 的 "Boot-time migrations" 段已按规格改写（Task 5）。
- [ ] 全仓库 grep `migrations.definitionGroupsPromoted` / `builtins.i18nKeysCleanedUp` / `migrations.qwen3BuiltinRemoved` / `migrations.modelGroupsCoalescedByVendor` 不再有引用（Task 3 Step 4）。

注：规格的验收第 3 条"删 ai-studio.db 后能正常启动" 是**人工测试**，单独在 Task 7 执行。

---

## Task 7: 人工启动验证（destructive — 需用户授权）

**Why a separate task**: 这一步要删除开发者本地的 `data/ai-studio.db`，是 destructive 操作。规格 §"开发者本地数据库重置"已说明此为预期行为，但仍由实施者征得用户/自己同意后执行。

**Files:** 无修改。

- [ ] **Step 1: 删除本地数据库**

询问用户确认后，运行：

```
rm F:/work/ai-studio/data/ai-studio.db
rm -f F:/work/ai-studio/data/ai-studio.db-shm F:/work/ai-studio/data/ai-studio.db-wal
```

Expected: 文件被删除（如不存在则 -f 静默）。

注意：用户若 unwilling 删库，可改为重命名 `mv ai-studio.db ai-studio.db.bak`，验证完成后再决定恢复或丢弃。

- [ ] **Step 2: 启动应用 dev 模式**

Run（开发者会看到 Electron 窗口启动）：

```
npm run dev
```

Expected：应用正常启动到主界面，无错误对话框、终端无 stack trace。

- [ ] **Step 3: 验证 seed 数据齐全**

启动后人工检查：

1. 左侧助手栏：应当有"默认助手"。
2. 设置 → 助手库：应当能看到约 10 个 built-in templates（中文）。
3. 设置 → Model Library：应当有内置 model definitions（不应有 Qwen3 行）。
4. 设置 → Model Groups：应当是 vendor 格式（Claude / GPT / DeepSeek / Gemini / Silicon Pro 之类），**不应**含 `claude-opus`、`gpt-5` 等细粒度旧 v1 行。
5. 在 Quick Assistant (Ctrl+Shift+Space)：应能看到 4 个内置 quick actions（answer / translate / summarize / image-translate）。
6. 设置 → Selection Assistant：应能看到 5 个内置 selection actions（translate / explain / summarize / rewrite / search）。

如以上任一条不达预期，回到对应的 seed 文件检查（catalogs.ts / seed-model-_.json / builtins/_.ts）。

- [ ] **Step 4: 验证 user_version 为 0**

在 `src/main/migrate/index.ts:runMigrations()` 函数体首行临时加一行：

```ts
console.log('[migrate] current user_version =', current)
```

重启 `npm run dev`，看终端首条 `[migrate]` 输出。

Expected: `[migrate] current user_version = 0`（新装库无任何已应用迁移）。

**验证完成后立刻删除这行调试代码**，并 `git status` 确认未污染本次 stage。

---

## Task 8: 最终 commit

- [ ] **Step 1: 查看 stage 状态**

Run:

```
git status
git diff --staged
```

Expected: 已 stage 的改动包含：

- Modified: `src/main/migrate/index.ts`
- Deleted: 8 个 `src/main/migrate/*.ts` 旧迁移文件
- Modified: `CLAUDE.md`
- Modified: `src/main/backup/dirty-tracker.ts`（如 Task 4 执行了）

未 stage 的：检查 Task 7 Step 4 的调试 `console.log` 是否已被撤回。

- [ ] **Step 2: commit**

```
git commit -m "refactor(migrate): switch to PRAGMA user_version-based scheduler

把每次启动跑 8 个含幂等门的迁移函数改成基于 PRAGMA user_version 的极简调度器。
src/main/migrate/index.ts 现在约 30 行、MIGRATIONS 数组首次落地为空、启动开销趋近于 0。

现有 8 个迁移的 schema 终态早已在 createTables() 中就位；本次仅在 seedDatabaseDefaults()
补一处 seedAssistantTemplates() 调用（已在前置 commit 中完成）。

因应用未上线、无已部署老库，不写 bootstrap 兼容逻辑；开发者本地需删除 data/ai-studio.db 重建。

CLAUDE.md 的 Boot-time migrations 约定已同步改写。

Spec: docs/superpowers/specs/2026-05-17-migration-redesign-design.md"
```

Expected: commit 成功。

- [ ] **Step 3: 验证最终状态**

Run:

```
git log --oneline -3
ls src/main/migrate/
wc -l src/main/migrate/index.ts
```

Expected:

- 最近 3 个 commit：今天的 refactor(migrate) + 今天的 feat(db) seed 调整 + 之前的 docs(spec) 规格。
- `src/main/migrate/` 只有 `index.ts`。
- 行数 < 50。

---

## 完成检查

- [ ] Task 1 Step 4: feat(db) commit 完成
- [ ] Task 8 Step 2: refactor(migrate) commit 完成
- [ ] Task 7 Step 3: 启动验证 6 项全部达成
- [ ] 规格验收清单全部勾选

## 不在本计划内（明确不做）

- 不引入测试基础设施。
- 不写 `down()` / rollback。
- 不写 bootstrap-from-legacy 检测旧 setting。
- 不引入连续性 / 排序校验（数组为空时无意义；将来真的有迁移再加）。
- 不主动新增 `runMigrations` 的 try/catch（规格 §"错误处理"）。
- 不修改 `src/main/db/database.ts`（schema 已就位）。
- 不修改 `src/main/db/seeds/seed-model-*.json`（已是目标版本）。
- 不修改 `src/main/index.ts:455-456` 的 `runMigrations()` 调用（接口不变）。
