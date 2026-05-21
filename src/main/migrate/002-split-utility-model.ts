import type Database from 'better-sqlite3'

/**
 * Split the single `utilityModel.providerId` / `utilityModel.modelId` setting
 * into per-task keys, so the user can configure different models for
 * title generation vs. web-search query rewriting.
 *
 * For users that already had the unified utility model configured, copy the
 * same value into both task-specific keys so behavior is preserved.
 */
export const migration002SplitUtilityModel = {
  version: 2,
  name: 'split-utility-model',
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

    const provider = get('utilityModel.providerId')
    const model = get('utilityModel.modelId')

    if (provider && model) {
      set('utilityModel.titleProviderId', provider)
      set('utilityModel.titleModelId', model)
      set('utilityModel.searchRewriteProviderId', provider)
      set('utilityModel.searchRewriteModelId', model)
    }

    db.prepare(
      `DELETE FROM settings WHERE key IN ('utilityModel.providerId', 'utilityModel.modelId')`,
    ).run()
  },
}
