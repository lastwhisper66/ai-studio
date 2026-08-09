import type Database from 'better-sqlite3'

export const migration008ModelExtraParams = {
  version: 8,
  name: 'model-extra-params',
  up(db: Database.Database): void {
    db.exec(`ALTER TABLE models ADD COLUMN extra_params TEXT NOT NULL DEFAULT '{}'`)
  },
}
