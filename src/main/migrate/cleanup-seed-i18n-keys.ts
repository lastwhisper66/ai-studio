import type Database from 'better-sqlite3'
import { getDb } from '../db/database'
import { getSetting, setSetting } from '../db/settings'
import {
  ASSISTANT_TEMPLATES,
  DEFAULT_ASSISTANT,
  QUICK_ACTIONS,
  SELECTION_ACTIONS,
} from '../builtins'

/**
 * One-shot migration: the previous schema stored i18n keys like
 * `seed.templates.general.name` as field values in builtin rows; the new
 * schema uses literal text. Old installs would otherwise display these
 * keys verbatim in the UI. We rewrite any field on an `is_builtin=1` row
 * (or the singleton `default-assistant` row) whose value starts with
 * `seed.` to the literal value from the matching source entry. User-edited
 * fields (no `seed.` prefix) are left alone.
 *
 * `prompt_suggestions` on templates is a JSON-encoded string array; we
 * parse it and if any element starts with `seed.` (or parsing fails),
 * we replace the entire array with the source value.
 *
 * Gated by the `builtins.i18nKeysCleanedUp` setting — runs at most once.
 */
export function cleanupSeedI18nKeys(): void {
  if (getSetting('builtins.i18nKeysCleanedUp') === '1') return

  const db = getDb()
  db.transaction(() => {
    cleanupDefaultAssistant(db)
    cleanupAssistantTemplates(db)
    cleanupQuickActions(db)
    cleanupSelectionActions(db)
  })()

  setSetting('builtins.i18nKeysCleanedUp', '1')
}

function cleanupDefaultAssistant(db: Database.Database): void {
  db.prepare(
    `UPDATE assistants SET
       name = CASE WHEN name LIKE 'seed.%' THEN ? ELSE name END,
       description = CASE WHEN description LIKE 'seed.%' THEN ? ELSE description END
     WHERE id = ?`,
  ).run(DEFAULT_ASSISTANT.name, DEFAULT_ASSISTANT.description, DEFAULT_ASSISTANT.id)
}

function cleanupAssistantTemplates(db: Database.Database): void {
  const updateScalars = db.prepare(
    `UPDATE assistants SET
       name = CASE WHEN name LIKE 'seed.%' THEN ? ELSE name END,
       description = CASE WHEN description LIKE 'seed.%' THEN ? ELSE description END,
       system_prompt = CASE WHEN system_prompt LIKE 'seed.%' THEN ? ELSE system_prompt END,
       icon = CASE WHEN icon LIKE 'seed.%' THEN ? ELSE icon END
     WHERE id = ? AND is_builtin = 1 AND kind = 'template'`,
  )
  const readSuggestions = db.prepare(
    `SELECT prompt_suggestions FROM assistants WHERE id = ? AND is_builtin = 1 AND kind = 'template'`,
  )
  const updateSuggestions = db.prepare(
    `UPDATE assistants SET prompt_suggestions = ?, updated_at = datetime('now')
     WHERE id = ? AND is_builtin = 1 AND kind = 'template'`,
  )

  for (const s of ASSISTANT_TEMPLATES) {
    updateScalars.run(s.name, s.description, s.systemPrompt, s.icon, s.id)

    const row = readSuggestions.get(s.id) as { prompt_suggestions: string } | undefined
    if (!row) continue
    let containsSeed = true
    try {
      const parsed = JSON.parse(row.prompt_suggestions) as unknown
      if (Array.isArray(parsed)) {
        containsSeed = parsed.some((v) => typeof v === 'string' && v.startsWith('seed.'))
      }
    } catch {
      containsSeed = true
    }
    if (containsSeed) {
      updateSuggestions.run(JSON.stringify(s.promptSuggestions), s.id)
    }
  }
}

function cleanupQuickActions(db: Database.Database): void {
  const stmt = db.prepare(
    `UPDATE quick_actions SET
       name = CASE WHEN name LIKE 'seed.%' THEN ? ELSE name END,
       description = CASE WHEN description LIKE 'seed.%' THEN ? ELSE description END,
       system_prompt = CASE WHEN system_prompt LIKE 'seed.%' THEN ? ELSE system_prompt END,
       icon = CASE WHEN icon LIKE 'seed.%' THEN ? ELSE icon END
     WHERE id = ? AND is_builtin = 1`,
  )
  for (const b of QUICK_ACTIONS) {
    stmt.run(b.name, b.description, b.systemPrompt, b.icon, b.id)
  }
}

function cleanupSelectionActions(db: Database.Database): void {
  const stmt = db.prepare(
    `UPDATE selection_actions SET
       name = CASE WHEN name LIKE 'seed.%' THEN ? ELSE name END,
       description = CASE WHEN description LIKE 'seed.%' THEN ? ELSE description END,
       system_prompt = CASE WHEN system_prompt LIKE 'seed.%' THEN ? ELSE system_prompt END,
       icon = CASE WHEN icon LIKE 'seed.%' THEN ? ELSE icon END
     WHERE id = ? AND is_builtin = 1`,
  )
  for (const b of SELECTION_ACTIONS) {
    stmt.run(b.name, b.description, b.systemPrompt, b.icon, b.id)
  }
}
