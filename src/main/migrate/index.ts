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
import { migration002SplitUtilityModel } from './002-split-utility-model'

interface Migration {
  version: number
  name: string
  up(db: Database.Database): void
}

const MIGRATIONS: Migration[] = [migration001MessagesSources, migration002SplitUtilityModel]

export function runMigrations(isNewDatabase: boolean = false): void {
  const db = getDb()
  const latest = MIGRATIONS.length > 0 ? MIGRATIONS[MIGRATIONS.length - 1].version : 0

  // A freshly created database already has the final schema from `createTables()`,
  // so historical migrations (e.g. ALTER TABLE … ADD COLUMN sources) would fail with
  // "duplicate column" errors. Skip them and stamp user_version to the latest.
  if (isNewDatabase) {
    if (latest > 0) db.pragma(`user_version = ${latest}`)
    return
  }

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
