import type Database from 'better-sqlite3'

export const migration001MessagesSources = {
  version: 1,
  name: 'messages-sources',
  up(db: Database.Database): void {
    db.exec(`ALTER TABLE messages ADD COLUMN sources TEXT`)
  },
}
