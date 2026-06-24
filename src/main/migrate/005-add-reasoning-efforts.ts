import type Database from 'better-sqlite3'

export const migration005AddReasoningEfforts = {
  version: 5,
  name: 'add-reasoning-efforts',
  up(db: Database.Database): void {
    db.exec(`ALTER TABLE model_definitions ADD COLUMN reasoning_efforts TEXT`)
  },
}
