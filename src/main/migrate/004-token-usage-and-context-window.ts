import type Database from 'better-sqlite3'

const CONTEXT_WINDOW_BACKFILL = [
  { name: 'gpt-5.4', contextWindow: 128000 },
  { name: 'gpt-5.4-mini', contextWindow: 128000 },
  { name: 'gpt-5.4-nano', contextWindow: 128000 },
  { name: 'gpt-5.4-pro', contextWindow: 128000 },
  { name: 'gpt-5.1', contextWindow: 128000 },
  { name: 'gpt-5.1-mini', contextWindow: 128000 },
  { name: 'claude-opus-4-7', contextWindow: 200000 },
  { name: 'claude-opus-4-6', contextWindow: 200000 },
  { name: 'claude-sonnet-4-6', contextWindow: 200000 },
  { name: 'claude-haiku-4-5', contextWindow: 200000 },
  { name: 'gemini-3.1-pro-preview', contextWindow: 1000000 },
  { name: 'gemini-3.1-flash-lite-preview', contextWindow: 1000000 },
  { name: 'gemini-3-flash-preview', contextWindow: 1000000 },
  { name: 'gemini-2.5-pro', contextWindow: 1000000 },
  { name: 'gemini-2.5-flash', contextWindow: 1000000 },
  { name: 'gemini-2.5-flash-lite', contextWindow: 1000000 },
  { name: 'deepseek-chat', contextWindow: 65536 },
  { name: 'deepseek-reasoner', contextWindow: 65536 },
  { name: 'deepseek-ai/DeepSeek-V3.2', contextWindow: 65536 },
  { name: 'deepseek-ai/DeepSeek-R1', contextWindow: 65536 },
  { name: 'Pro/zai-org/GLM-5', contextWindow: 128000 },
] as const

export const migration004TokenUsageAndContextWindow = {
  version: 4,
  name: 'token-usage-and-context-window',
  up(db: Database.Database): void {
    db.exec(`ALTER TABLE messages ADD COLUMN input_tokens INTEGER`)
    db.exec(`ALTER TABLE messages ADD COLUMN output_tokens INTEGER`)
    db.exec(`ALTER TABLE model_definitions ADD COLUMN context_window INTEGER`)

    const update = db.prepare(
      `UPDATE model_definitions
       SET context_window = ?
       WHERE name = ? AND updated_at = created_at`,
    )
    for (const seed of CONTEXT_WINDOW_BACKFILL) {
      update.run(seed.contextWindow, seed.name)
    }
  },
}
