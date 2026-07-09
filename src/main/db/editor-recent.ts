import type { RecentEntry } from '@shared/types'
import { getDb } from './database'

const MAX_RECENT = 20

export function listRecent(): RecentEntry[] {
  return getDb()
    .prepare(
      `SELECT path, kind, opened_at as openedAt
       FROM editor_recent_files
       ORDER BY opened_at DESC
       LIMIT ?`,
    )
    .all(MAX_RECENT) as RecentEntry[]
}

export function addRecent(path: string, kind: 'file' | 'folder'): void {
  getDb()
    .prepare(
      `INSERT INTO editor_recent_files (path, kind, opened_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(path) DO UPDATE SET opened_at = datetime('now')`,
    )
    .run(path, kind)
}

export function removeRecent(path: string): void {
  getDb().prepare('DELETE FROM editor_recent_files WHERE path = ?').run(path)
}

export function clearRecent(): void {
  getDb().prepare('DELETE FROM editor_recent_files').run()
}
