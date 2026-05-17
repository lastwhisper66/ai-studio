import { getDb } from '../db/database'
import { getSetting, setSetting } from '../db/settings'

/**
 * One-shot migration: remove the legacy Qwen3 built-in model definition and
 * the matching model_groups row created by the v1 promote migration. Only
 * rows the user has not edited (updated_at == created_at) are deleted —
 * any user customisation is preserved.
 */
export function removeQwen3Builtin(): void {
  if (getSetting('migrations.qwen3BuiltinRemoved') === '1') return

  const db = getDb()
  db.transaction(() => {
    db.prepare(
      `DELETE FROM model_definitions
       WHERE name = 'Qwen/Qwen3-235B-A22B'
         AND updated_at = created_at`,
    ).run()
    db.prepare(
      `DELETE FROM model_groups
       WHERE LOWER(pattern) = 'qwen3'
         AND updated_at = created_at`,
    ).run()
  })()

  setSetting('migrations.qwen3BuiltinRemoved', '1')
}
