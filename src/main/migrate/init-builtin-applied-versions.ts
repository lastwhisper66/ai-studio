import { getSetting, setSetting } from '../db/settings'
import {
  BUILTIN_TEMPLATES_VERSION,
  BUILTIN_QUICK_ACTIONS_VERSION,
  BUILTIN_SELECTION_ACTIONS_VERSION,
} from '../builtins'

/**
 * Idempotent: ensure the three `builtins.<category>.appliedVersion` settings
 * exist. On a fresh install, they're set to the current source version, so the
 * "updates available" banners don't appear. On an upgrade where these keys are
 * missing, we treat the user as already aligned with the current source — they
 * pick up future updates only after a real version bump in the source files.
 */
export function initBuiltinAppliedVersions(): void {
  if (getSetting('builtins.templates.appliedVersion') === undefined) {
    setSetting('builtins.templates.appliedVersion', String(BUILTIN_TEMPLATES_VERSION))
  }
  if (getSetting('builtins.quickActions.appliedVersion') === undefined) {
    setSetting('builtins.quickActions.appliedVersion', String(BUILTIN_QUICK_ACTIONS_VERSION))
  }
  if (getSetting('builtins.selectionActions.appliedVersion') === undefined) {
    setSetting(
      'builtins.selectionActions.appliedVersion',
      String(BUILTIN_SELECTION_ACTIONS_VERSION),
    )
  }
}
