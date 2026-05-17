import { getDb } from '../db/database'

/**
 * One-shot migration: drop the obsolete `provider_types` column from
 * `model_definitions`. The column never participated in any runtime logic
 * (it was only set/displayed by the "Applicable Providers" UI, which has been
 * removed), so dropping it is purely a cleanup.
 *
 * Idempotent: detects column presence via PRAGMA before issuing the DDL, so
 * re-running on an already-migrated database is a no-op. Safe on first install
 * too — the column won't exist there.
 *
 * Requires SQLite >= 3.35 for ALTER TABLE ... DROP COLUMN, which better-sqlite3
 * 11.x ships with.
 */
export function dropModelDefinitionProviderTypes(): void {
  const db = getDb()
  const cols = db.prepare('PRAGMA table_info(model_definitions)').all() as { name: string }[]
  if (!cols.some((c) => c.name === 'provider_types')) return
  db.exec('ALTER TABLE model_definitions DROP COLUMN provider_types')
}
