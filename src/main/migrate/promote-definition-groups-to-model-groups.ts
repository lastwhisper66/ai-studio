import { randomUUID } from 'crypto'
import { getDb } from '../db/database'
import { getSetting, setSetting } from '../db/settings'

/**
 * One-shot migration: lift each distinct `model_definitions.group_name` value
 * into the `model_groups` table (pattern = displayName = group_name) so that
 * `model_groups` becomes the single source of truth for "which model belongs
 * to which group". `model_definitions.group_name` is left in place to avoid
 * disturbing existing seeds, but the new UI does not read or write it.
 *
 * Gated by the `migrations.definitionGroupsPromoted` setting — runs at most
 * once. Case-insensitive deduplication against existing `model_groups.pattern`
 * prevents conflicts (e.g. "GPT-4o" vs "gpt-4o").
 */
export function promoteDefinitionGroupsToModelGroups(): void {
  if (getSetting('migrations.definitionGroupsPromoted') === '1') return

  const db = getDb()
  db.transaction(() => {
    const rows = db
      .prepare(
        `SELECT DISTINCT group_name FROM model_definitions
         WHERE group_name IS NOT NULL AND TRIM(group_name) <> ''`,
      )
      .all() as { group_name: string }[]

    const existing = new Set(
      (db.prepare('SELECT pattern FROM model_groups').all() as { pattern: string }[]).map((r) =>
        r.pattern.toLowerCase(),
      ),
    )

    let nextOrder = (
      db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM model_groups').get() as {
        m: number
      }
    ).m

    const insert = db.prepare(
      `INSERT OR IGNORE INTO model_groups (id, pattern, display_name, sort_order)
       VALUES (?, ?, ?, ?)`,
    )

    for (const { group_name } of rows) {
      if (existing.has(group_name.toLowerCase())) continue
      nextOrder += 1
      insert.run(randomUUID(), group_name, group_name, nextOrder)
      existing.add(group_name.toLowerCase())
    }
  })()

  setSetting('migrations.definitionGroupsPromoted', '1')
}
