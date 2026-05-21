import type Database from 'better-sqlite3'

/**
 * Decouple "the provider the chat uses at runtime" from "the tab currently
 * selected in the settings page". Introduce a new key
 * `webSearch.defaultProvider` for the former; `webSearch.provider` is
 * repurposed as a pure UI preference (which tab is open).
 *
 * For users that already had a provider chosen, copy that value into the new
 * key so search behaviour does not change after upgrade.
 */
export const migration003WebSearchDefaultProvider = {
  version: 3,
  name: 'web-search-default-provider',
  up(db: Database.Database): void {
    const get = (key: string): string | undefined =>
      (
        db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
          | { value: string }
          | undefined
      )?.value

    const set = (key: string, value: string): void => {
      db.prepare(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ).run(key, value)
    }

    const existingDefault = get('webSearch.defaultProvider')
    if (existingDefault) return // already set, nothing to do

    const legacy = get('webSearch.provider')
    if (legacy) {
      set('webSearch.defaultProvider', legacy)
    }
  },
}
