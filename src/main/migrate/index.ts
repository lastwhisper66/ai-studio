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
import { cleanupSeedI18nKeys } from './cleanup-seed-i18n-keys'
import { initBuiltinAppliedVersions } from './init-builtin-applied-versions'
import { promoteDefinitionGroupsToModelGroups } from './promote-definition-groups-to-model-groups'

export {
  migrateBackupSettings,
  migrateAssistantLibraryFields,
  cleanupSeedI18nKeys,
  initBuiltinAppliedVersions,
  promoteDefinitionGroupsToModelGroups,
}

export function runMigrations(): void {
  migrateBackupSettings()
  migrateAssistantLibraryFields()
  cleanupSeedI18nKeys() // Must run AFTER assistant-library-fields seeds templates.
  initBuiltinAppliedVersions() // Idempotent; runs every boot but writes only on first.
  promoteDefinitionGroupsToModelGroups()
}
