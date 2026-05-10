import { getDb } from '../db/database'
import { seedAssistantTemplates } from '../db/templates'

/**
 * Idempotent migration adding the six library fields to the `assistants`
 * table. Each ALTER is preceded by a `PRAGMA table_info` check so re-running
 * is a no-op. Also:
 *   - Promotes the seeded default assistant from `source='user'` (the column
 *     default after ALTER) to `source='builtin'` so its source matches its
 *     semantics. Idempotent: rerun does nothing.
 *   - Calls `seedAssistantTemplates()` AFTER the columns exist. The seed is
 *     itself one-shot (gated by the `templates.builtinsSeeded` setting) so
 *     deleted built-ins do not come back on every boot.
 *
 * Why we seed from inside the migration instead of `seedDatabaseDefaults`:
 * `seedDatabaseDefaults` runs inside `createTables()` BEFORE migrations, but
 * on an existing-install upgrade the new columns don't yet exist, so an
 * INSERT touching those columns would fail. Running the seed here means the
 * ALTERs are guaranteed to have been applied.
 */
export function migrateAssistantLibraryFields(): void {
  const db = getDb()
  const cols = db.prepare('PRAGMA table_info(assistants)').all() as { name: string }[]
  const have = new Set(cols.map((c) => c.name))

  if (!have.has('kind')) {
    db.exec("ALTER TABLE assistants ADD COLUMN kind TEXT NOT NULL DEFAULT 'assistant'")
  }
  if (!have.has('category')) {
    db.exec("ALTER TABLE assistants ADD COLUMN category TEXT NOT NULL DEFAULT ''")
  }
  if (!have.has('recommended_model')) {
    db.exec("ALTER TABLE assistants ADD COLUMN recommended_model TEXT NOT NULL DEFAULT ''")
  }
  if (!have.has('source')) {
    db.exec("ALTER TABLE assistants ADD COLUMN source TEXT NOT NULL DEFAULT 'user'")
  }
  if (!have.has('is_builtin')) {
    db.exec('ALTER TABLE assistants ADD COLUMN is_builtin INTEGER NOT NULL DEFAULT 0')
  }
  if (!have.has('source_template_id')) {
    db.exec('ALTER TABLE assistants ADD COLUMN source_template_id TEXT')
  }

  db.exec('CREATE INDEX IF NOT EXISTS idx_assistants_kind     ON assistants(kind)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_assistants_category ON assistants(category)')

  // Promote the seeded default assistant to source='builtin' if it is still
  // 'user' (the post-ALTER default). Idempotent: rerun does nothing.
  db.prepare(
    "UPDATE assistants SET source = 'builtin' WHERE id = 'default-assistant' AND source = 'user'",
  ).run()

  // Seed built-in templates (one-shot via `templates.builtinsSeeded` flag).
  seedAssistantTemplates()
}
