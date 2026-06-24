import type Database from 'better-sqlite3'

interface Row {
  id: string
  capabilities: string
}

/**
 * 历史数据可能在 capabilities JSON 数组里含 "web" 字符串(应用此前的 ModelCapability 之一)。
 * 本次重构移除了该维度,把所有 capabilities 数组里的 "web" strip 掉。
 *
 * 重要:只 UPDATE capabilities 字段,不动 updated_at。否则会触发"用户编辑保护"机制,
 * 导致后续 OpenRouter 同步无法再覆盖这些历史行(它们会被认为是"用户已编辑")。
 *
 * SQLite 无内置"从 JSON 数组移除元素"函数;走 JS 端读 → 过滤 → 写回。
 */
export const migration006StripWebCapability = {
  version: 6,
  name: 'strip-web-capability',
  up(db: Database.Database): void {
    for (const table of ['model_definitions', 'models'] as const) {
      const rows = db.prepare(`SELECT id, capabilities FROM ${table}`).all() as Row[]
      const update = db.prepare(`UPDATE ${table} SET capabilities = ? WHERE id = ?`)
      for (const row of rows) {
        if (!row.capabilities || !row.capabilities.includes('"web"')) continue
        let parsed: unknown
        try {
          parsed = JSON.parse(row.capabilities)
        } catch {
          continue
        }
        if (!Array.isArray(parsed)) continue
        const filtered = parsed.filter((c) => c !== 'web')
        update.run(JSON.stringify(filtered), row.id)
      }
    }
  },
}
