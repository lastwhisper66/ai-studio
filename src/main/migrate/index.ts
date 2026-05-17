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
import { dropModelDefinitionProviderTypes } from './drop-model-definition-provider-types'
import { coalesceModelGroupsByVendor } from './coalesce-model-groups-by-vendor'
import { removeQwen3Builtin } from './remove-qwen3-builtin'

export {
  migrateBackupSettings,
  migrateAssistantLibraryFields,
  cleanupSeedI18nKeys,
  initBuiltinAppliedVersions,
  promoteDefinitionGroupsToModelGroups,
  dropModelDefinitionProviderTypes,
  coalesceModelGroupsByVendor,
  removeQwen3Builtin,
}

export function runMigrations(): void {
  migrateBackupSettings()
  migrateAssistantLibraryFields()
  cleanupSeedI18nKeys() // Must run AFTER assistant-library-fields seeds templates.
  initBuiltinAppliedVersions() // Idempotent; runs every boot but writes only on first.
  promoteDefinitionGroupsToModelGroups()
  dropModelDefinitionProviderTypes()
  coalesceModelGroupsByVendor() // Must run AFTER promote… so it can clean up rows promote created.
  removeQwen3Builtin() // Must run AFTER promote… so it can clean up the Qwen3 group it created.
}
