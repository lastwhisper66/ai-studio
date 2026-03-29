import Database from 'better-sqlite3'
import { app } from 'electron'
import { existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { seedModelDefinitions } from './model-definitions'

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
      system_prompt TEXT,
      assistant_id TEXT,
      pinned INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'divider')),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      token_count INTEGER,
      attachments TEXT,
      duration INTEGER,
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

    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      api_key TEXT NOT NULL DEFAULT '',
      base_url TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '',
      endpoint TEXT NOT NULL DEFAULT '',
      api_version TEXT NOT NULL DEFAULT '',
      deployment_name TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS models (
      id TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL,
      name TEXT NOT NULL,
      group_name TEXT NOT NULL DEFAULT '',
      capabilities TEXT NOT NULL DEFAULT '[]',
      enabled INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_models_provider_id
      ON models(provider_id);

    CREATE TABLE IF NOT EXISTS phrases (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS assistants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      system_prompt TEXT NOT NULL DEFAULT '',
      provider_id TEXT,
      model TEXT NOT NULL DEFAULT '',
      temperature TEXT NOT NULL DEFAULT '',
      max_completion_tokens TEXT NOT NULL DEFAULT '',
      top_p TEXT NOT NULL DEFAULT '',
      context_count TEXT NOT NULL DEFAULT '10',
      prompt_suggestions TEXT NOT NULL DEFAULT '[]',
      is_default INTEGER NOT NULL DEFAULT 0,
      group_name TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  database.exec(`
    CREATE TABLE IF NOT EXISTS translation_history (
      id TEXT PRIMARY KEY,
      source_text TEXT NOT NULL,
      translated_text TEXT NOT NULL,
      source_lang TEXT NOT NULL,
      target_lang TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  database.exec(`
    CREATE TABLE IF NOT EXISTS model_definitions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      group_name TEXT NOT NULL DEFAULT '',
      capabilities TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_model_definitions_name
      ON model_definitions(name);
  `)

  // Seed: ensure a default assistant exists
  const hasDefault = database
    .prepare('SELECT COUNT(*) as cnt FROM assistants WHERE is_default = 1')
    .get() as { cnt: number }
  if (hasDefault.cnt === 0) {
    database
      .prepare(
        `INSERT INTO assistants (id, name, description, is_default, sort_order)
         VALUES ('default-assistant', '默认助手', '使用全局设置的通用 AI 助手', 1, -1)`,
      )
      .run()
  }

  // Auto-fill: if the default assistant has no model, pick the first available provider+model
  const defaultAssistant = database
    .prepare('SELECT provider_id, model FROM assistants WHERE is_default = 1')
    .get() as { provider_id: string | null; model: string } | undefined
  if (defaultAssistant && !defaultAssistant.provider_id && !defaultAssistant.model) {
    const firstModel = database
      .prepare(
        `SELECT p.id AS provider_id, m.name AS model_name
         FROM providers p
         JOIN models m ON m.provider_id = p.id AND m.enabled = 1
         WHERE p.enabled = 1
         ORDER BY p.sort_order ASC, m.sort_order ASC
         LIMIT 1`,
      )
      .get() as { provider_id: string; model_name: string } | undefined
    if (firstModel) {
      database
        .prepare(
          `UPDATE assistants SET provider_id = ?, model = ?, updated_at = datetime('now')
           WHERE is_default = 1`,
        )
        .run(firstModel.provider_id, firstModel.model_name)
    }
  }

  // Seed: populate model definitions from static catalog
  seedModelDefinitions()
}
