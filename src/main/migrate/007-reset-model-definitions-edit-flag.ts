import type Database from 'better-sqlite3'

/**
 * 一次性清理:历史 `seedModelDefinitions` 使用过 buggy SQL —— ON CONFLICT 时
 * `SET ... updated_at = datetime('now')` —— 把每次 seed re-run(从 v2 起)
 * 触及的行的 `updated_at` 推到 != `created_at`。
 *
 * 新的 catalog-sync 把 `WHERE updated_at = created_at` 当作"用户从未编辑过"的
 * 判据。如果不清理,所有被旧 seed 锁死的历史行会被 catalog-sync 误判为"用户已
 * 编辑",OpenRouter 后续对这些模型的元数据更新永远进不来。
 *
 * 把所有现存 `model_definitions` 行的 `updated_at` 拉回 `created_at`,让
 * catalog-sync 能从干净状态接管所有历史 seed 写入的行。
 *
 * 副作用:升级用户在 v1.10.0(catalog-sync 上线)之前手动编辑过的少数行,
 * 下次同步会被 OpenRouter 覆盖回上游默认。这是设计可接受的代价 ——
 * spec §6.4 已说明"要恢复 OpenRouter 默认,用户在 UI 上删除该条即可",
 * 反向覆盖语义对称。
 */
export const migration007ResetModelDefinitionsEditFlag = {
  version: 7,
  name: 'reset-model-definitions-edit-flag',
  up(db: Database.Database): void {
    db.exec(`UPDATE model_definitions SET updated_at = created_at`)
  },
}
