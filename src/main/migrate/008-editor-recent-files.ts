import type Database from 'better-sqlite3'

export const migration008EditorRecentFiles = {
  version: 8,
  name: 'editor-recent-files',
  up(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS editor_recent_files (
        path       TEXT PRIMARY KEY,
        kind       TEXT NOT NULL CHECK (kind IN ('file', 'folder')),
        opened_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_editor_recent_files_opened_at
        ON editor_recent_files(opened_at);
    `)
  },
}
