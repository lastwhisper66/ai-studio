/**
 * Central registry of one-shot, idempotent boot-time migrations.
 *
 * Each migration MUST be:
 *   - Idempotent (re-running after success is a no-op).
 *   - Self-contained (no cross-migration ordering assumptions unless declared
 *     by listing them in `runMigrations` in the intended order).
 *   - Forgiving — never throw on already-migrated data.
 *
 * Add new migrations here so the boot sequence in `src/main/index.ts` stays
 * a single `runMigrations()` call.
 */

import { migrateBackupSettings } from './backup-settings'
import { migrateAssistantLibraryFields } from './assistant-library-fields'

export { migrateBackupSettings, migrateAssistantLibraryFields }

export function runMigrations(): void {
  migrateBackupSettings()
  migrateAssistantLibraryFields()
}
