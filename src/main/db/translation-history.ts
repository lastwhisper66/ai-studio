import { randomUUID } from 'crypto'
import { getDb } from './database'
import type { TranslationHistoryItem } from '@shared/types'

export interface TranslationHistoryRow {
  id: string
  source_text: string
  translated_text: string
  source_lang: string
  target_lang: string
  created_at: string
}

function toItem(row: TranslationHistoryRow): TranslationHistoryItem {
  return {
    id: row.id,
    sourceText: row.source_text,
    translatedText: row.translated_text,
    sourceLang: row.source_lang,
    targetLang: row.target_lang,
    createdAt: row.created_at,
  }
}

const MAX_HISTORY = 50

export function createTranslationHistory(
  sourceText: string,
  translatedText: string,
  sourceLang: string,
  targetLang: string,
): TranslationHistoryItem {
  const db = getDb()
  const id = randomUUID()
  db.prepare(
    `INSERT INTO translation_history (id, source_text, translated_text, source_lang, target_lang)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, sourceText, translatedText, sourceLang, targetLang)

  // Trim old entries beyond limit
  db.prepare(
    `DELETE FROM translation_history WHERE id NOT IN (
       SELECT id FROM translation_history ORDER BY created_at DESC LIMIT ?
     )`,
  ).run(MAX_HISTORY)

  const row = db
    .prepare('SELECT * FROM translation_history WHERE id = ?')
    .get(id) as TranslationHistoryRow
  return toItem(row)
}

export function listTranslationHistory(): TranslationHistoryItem[] {
  const rows = getDb()
    .prepare('SELECT * FROM translation_history ORDER BY created_at DESC')
    .all() as TranslationHistoryRow[]
  return rows.map(toItem)
}

export function clearTranslationHistory(): void {
  getDb().prepare('DELETE FROM translation_history').run()
}
