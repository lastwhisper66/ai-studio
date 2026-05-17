import { getDb } from '../db/database'
import { getSetting, setSetting } from '../db/settings'

/**
 * Legacy model-group patterns that were superseded by the v2 vendor-grained
 * seed (Claude / GPT / DeepSeek / Gemini / Silicon Pro). Covers both the
 * original v1 seed patterns and any displayName-as-pattern rows that the
 * `promote-definition-groups-to-model-groups` migration may have produced.
 * Comparison is case-insensitive.
 */
const LEGACY_PATTERNS = [
  // v1 seed-model-groups patterns
  'claude-opus',
  'claude-sonnet',
  'claude-haiku',
  'gpt-5',
  'gpt-5.1',
  'gpt-5.3',
  'gpt-5.4',
  'deepseek-chat',
  'deepseek-reasoner',
  'gemini-3',
  'gemini-2.5',
  'text-embedding',
  // promoted from model_definitions.group_name (pre-v4)
  'claude opus',
  'claude sonnet',
  'claude haiku',
  'gemini 3.1',
  'gemini 3',
  'gemini 2.5',
  'deepseek-v3.2',
]

/**
 * One-shot migration: collapse the legacy fine-grained model_groups rows
 * (per sub-model / per version) so the vendor-grained v2 seed becomes the
 * effective default. Only rows the user has not edited (updated_at == created_at)
 * are removed — manual edits are always preserved.
 */
export function coalesceModelGroupsByVendor(): void {
  if (getSetting('migrations.modelGroupsCoalescedByVendor') === '1') return

  const placeholders = LEGACY_PATTERNS.map(() => '?').join(', ')
  getDb()
    .prepare(
      `DELETE FROM model_groups
       WHERE LOWER(pattern) IN (${placeholders})
         AND updated_at = created_at`,
    )
    .run(...LEGACY_PATTERNS)

  setSetting('migrations.modelGroupsCoalescedByVendor', '1')
}
