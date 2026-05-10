import { randomUUID } from 'crypto'
import type { Assistant, AssistantSource, Provider, Model } from '@shared/types'
import { getDb } from './database'
import { rowToAssistant, type AssistantRow, listAssistants, getAssistant } from './assistants'
import { listProviders } from './providers'
import { listAllModels } from './models'
import { getSetting, setSetting } from './settings'
import { ASSISTANT_TEMPLATE_SEEDS } from './seeds/assistant-templates'

export interface CreateTemplateData {
  name: string
  icon?: string
  description?: string
  systemPrompt?: string
  promptSuggestions?: string[]
  category?: string
  recommendedModel?: string
  temperature?: string
  maxCompletionTokens?: string
  topP?: string
  contextCount?: string
  source?: AssistantSource
  isBuiltin?: boolean
  /** Optional fixed id (used by seed/import). Generates a random uuid otherwise. */
  id?: string
}

export interface UpdateTemplateData {
  name?: string
  icon?: string
  description?: string
  systemPrompt?: string
  promptSuggestions?: string[]
  category?: string
  recommendedModel?: string
  temperature?: string
  maxCompletionTokens?: string
  topP?: string
  contextCount?: string
}

// ── Reads ───────────────────────────────────────────────────────

export function listTemplates(): Assistant[] {
  const rows = getDb()
    .prepare(
      "SELECT * FROM assistants WHERE kind = 'template' ORDER BY sort_order ASC, created_at ASC",
    )
    .all() as AssistantRow[]
  return rows.map(rowToAssistant)
}

export function getTemplate(id: string): Assistant | undefined {
  const row = getDb()
    .prepare("SELECT * FROM assistants WHERE id = ? AND kind = 'template'")
    .get(id) as AssistantRow | undefined
  return row ? rowToAssistant(row) : undefined
}

// ── CRUD ────────────────────────────────────────────────────────

export function createTemplate(data: CreateTemplateData): Assistant {
  const id = data.id ?? randomUUID()
  const promptSuggestions = JSON.stringify(data.promptSuggestions ?? [])
  getDb()
    .prepare(
      `INSERT INTO assistants (
         id, kind, name, icon, description, system_prompt, provider_id, model,
         temperature, max_completion_tokens, top_p, context_count,
         prompt_suggestions, is_default, group_name, category,
         recommended_model, source, is_builtin, source_template_id, sort_order
       ) VALUES (?, 'template', ?, ?, ?, ?, NULL, '', ?, ?, ?, ?, ?, 0, '',
                 ?, ?, ?, ?, NULL, 0)`,
    )
    .run(
      id,
      data.name,
      data.icon ?? '',
      data.description ?? '',
      data.systemPrompt ?? '',
      data.temperature ?? '',
      data.maxCompletionTokens ?? '',
      data.topP ?? '',
      data.contextCount ?? '10',
      promptSuggestions,
      data.category ?? '',
      data.recommendedModel ?? '',
      data.source ?? 'user',
      data.isBuiltin ? 1 : 0,
    )
  return getTemplate(id)!
}

export function updateTemplate(id: string, data: UpdateTemplateData): Assistant | undefined {
  const fields: string[] = []
  const values: unknown[] = []

  const map: Array<[keyof UpdateTemplateData, string, (v: unknown) => unknown]> = [
    ['name', 'name', (v) => v],
    ['icon', 'icon', (v) => v],
    ['description', 'description', (v) => v],
    ['systemPrompt', 'system_prompt', (v) => v],
    ['promptSuggestions', 'prompt_suggestions', (v) => JSON.stringify(v)],
    ['category', 'category', (v) => v],
    ['recommendedModel', 'recommended_model', (v) => v],
    ['temperature', 'temperature', (v) => v],
    ['maxCompletionTokens', 'max_completion_tokens', (v) => v],
    ['topP', 'top_p', (v) => v],
    ['contextCount', 'context_count', (v) => v],
  ]

  for (const [key, col, transform] of map) {
    const v = data[key]
    if (v === undefined) continue
    fields.push(`${col} = ?`)
    values.push(transform(v))
  }

  if (fields.length === 0) return getTemplate(id)
  fields.push("updated_at = datetime('now')")
  values.push(id)

  getDb()
    .prepare(`UPDATE assistants SET ${fields.join(', ')} WHERE id = ? AND kind = 'template'`)
    .run(...values)
  return getTemplate(id)
}

export function deleteTemplate(id: string): void {
  getDb().prepare("DELETE FROM assistants WHERE id = ? AND kind = 'template'").run(id)
}

export function reorderTemplates(ids: string[]): void {
  const db = getDb()
  const update = db.prepare(
    "UPDATE assistants SET sort_order = ? WHERE id = ? AND kind = 'template'",
  )
  db.transaction(() => {
    ids.forEach((id, i) => update.run(i, id))
  })()
}

// ── Provider/model resolution ───────────────────────────────────

function resolveProviderModel(
  template: Assistant,
  defaultAssistant: Assistant | undefined,
  providers: Provider[],
  models: Model[],
): { providerId: string | null; model: string } {
  const rec = template.recommendedModel.trim()

  if (rec && defaultAssistant?.providerId) {
    const hit = models.find((m) => m.providerId === defaultAssistant.providerId && m.name === rec)
    if (hit) return { providerId: defaultAssistant.providerId, model: rec }
  }

  if (rec) {
    const enabledIds = new Set(providers.filter((p) => p.enabled).map((p) => p.id))
    const hit = models.find((m) => enabledIds.has(m.providerId) && m.name === rec)
    if (hit) return { providerId: hit.providerId, model: rec }
  }

  if (defaultAssistant?.providerId) {
    return { providerId: defaultAssistant.providerId, model: defaultAssistant.model }
  }

  return { providerId: null, model: rec }
}

// ── Add from template (fork) ────────────────────────────────────

export function addFromTemplate(templateId: string): Assistant {
  const template = getTemplate(templateId)
  if (!template) {
    throw new Error(`Template not found: ${templateId}`)
  }

  const db = getDb()
  const defaultAssistant = listAssistants().find((a) => a.isDefault)
  const providers = listProviders()
  const models = listAllModels()

  const { providerId, model } = resolveProviderModel(template, defaultAssistant, providers, models)

  const id = randomUUID()
  db.prepare(
    `INSERT INTO assistants (
       id, kind, name, icon, description, system_prompt, provider_id, model,
       temperature, max_completion_tokens, top_p, context_count,
       prompt_suggestions, is_default, group_name, category,
       recommended_model, source, is_builtin, source_template_id, sort_order
     ) VALUES (?, 'assistant', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '', '',
               '', 'user', 0, ?, 0)`,
  ).run(
    id,
    template.name,
    template.icon,
    template.description,
    template.systemPrompt,
    providerId,
    model,
    template.temperature,
    template.maxCompletionTokens,
    template.topP,
    template.contextCount,
    JSON.stringify(template.promptSuggestions),
    template.id,
  )

  return getAssistant(id)!
}

// ── Save assistant as template ──────────────────────────────────

export function saveAsTemplate(assistantId: string): Assistant {
  const a = getAssistant(assistantId)
  if (!a) throw new Error(`Assistant not found: ${assistantId}`)

  return createTemplate({
    name: a.name,
    icon: a.icon,
    description: a.description,
    systemPrompt: a.systemPrompt,
    promptSuggestions: a.promptSuggestions,
    category: a.group,
    recommendedModel: a.model,
    temperature: a.temperature,
    maxCompletionTokens: a.maxCompletionTokens,
    topP: a.topP,
    contextCount: a.contextCount,
    source: 'user',
    isBuiltin: false,
  })
}

// ── Seeding ─────────────────────────────────────────────────────

/** INSERT OR IGNORE the 10 built-in templates with i18n keys. */
function insertBuiltinTemplates(): void {
  const db = getDb()
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO assistants (
       id, kind, name, icon, description, system_prompt, provider_id, model,
       temperature, max_completion_tokens, top_p, context_count,
       prompt_suggestions, is_default, group_name, category,
       recommended_model, source, is_builtin, source_template_id, sort_order
     ) VALUES (?, 'template', ?, ?, ?, ?, NULL, '', ?, '', '', '10', ?, 0, '',
               ?, ?, 'builtin', 1, NULL, ?)`,
  )
  const seed = db.transaction(() => {
    ASSISTANT_TEMPLATE_SEEDS.forEach((s, i) => {
      stmt.run(
        s.id,
        s.nameKey,
        s.iconEmoji,
        s.descriptionKey,
        s.systemPromptKey,
        s.temperature ?? '',
        JSON.stringify(s.promptSuggestionKeys),
        s.category,
        s.recommendedModel,
        i,
      )
    })
  })
  seed()
}

/**
 * One-shot seed of built-in templates. Gated by the `templates.builtinsSeeded`
 * setting so user-deleted built-ins do NOT come back on every boot. Use
 * `resetBuiltinTemplates('restore-deleted')` to bypass the gate.
 */
export function seedAssistantTemplates(): void {
  if (getSetting('templates.builtinsSeeded') === '1') return
  insertBuiltinTemplates()
  setSetting('templates.builtinsSeeded', '1')
}

// ── Reset built-ins ─────────────────────────────────────────────

export type ResetBuiltinsMode = 'overwrite' | 'restore-deleted'

export function resetBuiltinTemplates(mode: ResetBuiltinsMode): void {
  const db = getDb()

  if (mode === 'overwrite') {
    const stmt = db.prepare(
      `UPDATE assistants SET
         name = ?, icon = ?, description = ?, system_prompt = ?,
         prompt_suggestions = ?, category = ?, recommended_model = ?,
         temperature = ?,
         updated_at = datetime('now')
       WHERE id = ? AND is_builtin = 1 AND kind = 'template'`,
    )
    db.transaction(() => {
      for (const s of ASSISTANT_TEMPLATE_SEEDS) {
        stmt.run(
          s.nameKey,
          s.iconEmoji,
          s.descriptionKey,
          s.systemPromptKey,
          JSON.stringify(s.promptSuggestionKeys),
          s.category,
          s.recommendedModel,
          s.temperature ?? '',
          s.id,
        )
      }
    })()
    return
  }

  // restore-deleted: bypass the one-shot gate to re-INSERT missing built-ins.
  insertBuiltinTemplates()
}
