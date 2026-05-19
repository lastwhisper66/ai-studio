/**
 * 启动期数据库迁移。
 *
 * 机制：用 SQLite 内置的 `PRAGMA user_version` 追踪"已应用到第几号迁移"。
 * 每个迁移只跑一次；启动开销趋近于 0。
 *
 * 新增迁移的步骤参见 CLAUDE.md → Key Conventions → "Boot-time migrations"。
 */

import type Database from 'better-sqlite3'
import { getDb } from '../db/database'
import { migration001MessagesSources } from './001-messages-sources'

interface Migration {
  version: number
  name: string
  up(db: Database.Database): void
}

const MIGRATIONS: Migration[] = [migration001MessagesSources]

export function runMigrations(): void {
  const db = getDb()
  const current = db.pragma('user_version', { simple: true }) as number
  for (const m of MIGRATIONS) {
    if (m.version <= current) continue
    db.transaction(() => {
      m.up(db)
      db.pragma(`user_version = ${m.version}`)
    })()
    console.log(`[migrate] applied ${m.version}-${m.name}`)
  }
}
