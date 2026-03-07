import Database from 'better-sqlite3'
import { app } from 'electron'
import { existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'

let db: Database.Database | null = null

export function initDatabase(): void {
  const appDir = app.isPackaged ? dirname(app.getPath('exe')) : app.getAppPath()
  const dataDir = join(appDir, 'data')
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }
  const dbPath = join(dataDir, 'ai-studio.db')
  db = new Database(dbPath)

  // Enable WAL mode for better concurrent read/write performance
  db.pragma('journal_mode = WAL')
  // Enable foreign key constraints
  db.pragma('foreign_keys = ON')

  createTables()
}

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

function createTables(): void {
  const database = getDb()

  database.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'New Chat',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      model TEXT,
      system_prompt TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      token_count INTEGER,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
      ON messages(conversation_id);

    CREATE INDEX IF NOT EXISTS idx_messages_created_at
      ON messages(created_at);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)
}
