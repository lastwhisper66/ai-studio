import { randomUUID } from 'crypto'
import type { Assistant } from '@shared/types'
import { ERROR_CODES } from '@shared/errors'
import { AppError } from '../errors'
import { getDb } from './database'

interface AssistantRow {
  id: string
  name: string
  icon: string
  description: string
  system_prompt: string
  provider_id: string | null
  model: string
  temperature: string
  max_completion_tokens: string
  top_p: string
  context_count: string
  prompt_suggestions: string
  is_default: number
  group_name: string
  sort_order: number
  created_at: string
  updated_at: string
}

function rowToAssistant(row: AssistantRow): Assistant {
  let promptSuggestions: string[] = []
  try {
    promptSuggestions = JSON.parse(row.prompt_suggestions)
  } catch {
    promptSuggestions = []
  }
  return {
    id: row.id,
    name: row.name,
    icon: row.icon ?? '',
    description: row.description,
    systemPrompt: row.system_prompt,
    providerId: row.provider_id,
    model: row.model,
    temperature: row.temperature,
    maxCompletionTokens: row.max_completion_tokens,
    topP: row.top_p,
    contextCount: row.context_count,
    promptSuggestions,
    isDefault: !!row.is_default,
    group: row.group_name,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function listAssistants(): Assistant[] {
  const rows = getDb()
    .prepare('SELECT * FROM assistants ORDER BY sort_order ASC, created_at ASC')
    .all() as AssistantRow[]
  return rows.map(rowToAssistant)
}

export function getAssistant(id: string): Assistant | undefined {
  const row = getDb().prepare('SELECT * FROM assistants WHERE id = ?').get(id) as
    | AssistantRow
    | undefined
  if (!row) return undefined
  return rowToAssistant(row)
}

export interface CreateAssistantData {
  name: string
  icon?: string
  description?: string
  systemPrompt?: string
  providerId?: string | null
  model?: string
  temperature?: string
  maxCompletionTokens?: string
  topP?: string
  contextCount?: string
  promptSuggestions?: string[]
  group?: string
  sortOrder?: number
}

export function createAssistant(data: CreateAssistantData): Assistant {
  const id = randomUUID()
  const promptSuggestions = JSON.stringify(data.promptSuggestions ?? [])
  getDb()
    .prepare(
      `INSERT INTO assistants (id, name, icon, description, system_prompt, provider_id, model, temperature, max_completion_tokens, top_p, context_count, prompt_suggestions, group_name, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      data.name,
      data.icon ?? '',
      data.description ?? '',
      data.systemPrompt ?? '',
      data.providerId ?? null,
      data.model ?? '',
      data.temperature ?? '',
      data.maxCompletionTokens ?? '',
      data.topP ?? '',
      data.contextCount ?? '',
      promptSuggestions,
      data.group ?? '',
      data.sortOrder ?? 0,
    )
  return getAssistant(id)!
}

export interface UpdateAssistantData {
  name?: string
  icon?: string
  description?: string
  systemPrompt?: string
  providerId?: string | null
  model?: string
  temperature?: string
  maxCompletionTokens?: string
  topP?: string
  contextCount?: string
  promptSuggestions?: string[]
  group?: string
  sortOrder?: number
}

export function updateAssistant(id: string, data: UpdateAssistantData): Assistant | undefined {
  const fields: string[] = []
  const values: unknown[] = []

  if (data.name !== undefined) {
    fields.push('name = ?')
    values.push(data.name)
  }
  if (data.icon !== undefined) {
    fields.push('icon = ?')
    values.push(data.icon)
  }
  if (data.description !== undefined) {
    fields.push('description = ?')
    values.push(data.description)
  }
  if (data.systemPrompt !== undefined) {
    fields.push('system_prompt = ?')
    values.push(data.systemPrompt)
  }
  if (data.providerId !== undefined) {
    fields.push('provider_id = ?')
    values.push(data.providerId)
  }
  if (data.model !== undefined) {
    fields.push('model = ?')
    values.push(data.model)
  }
  if (data.temperature !== undefined) {
    fields.push('temperature = ?')
    values.push(data.temperature)
  }
  if (data.maxCompletionTokens !== undefined) {
    fields.push('max_completion_tokens = ?')
    values.push(data.maxCompletionTokens)
  }
  if (data.topP !== undefined) {
    fields.push('top_p = ?')
    values.push(data.topP)
  }
  if (data.contextCount !== undefined) {
    fields.push('context_count = ?')
    values.push(data.contextCount)
  }
  if (data.promptSuggestions !== undefined) {
    fields.push('prompt_suggestions = ?')
    values.push(JSON.stringify(data.promptSuggestions))
  }
  if (data.group !== undefined) {
    fields.push('group_name = ?')
    values.push(data.group)
  }
  if (data.sortOrder !== undefined) {
    fields.push('sort_order = ?')
    values.push(data.sortOrder)
  }

  if (fields.length === 0) return getAssistant(id)

  fields.push("updated_at = datetime('now')")
  values.push(id)

  getDb()
    .prepare(`UPDATE assistants SET ${fields.join(', ')} WHERE id = ?`)
    .run(...values)

  return getAssistant(id)
}

export function deleteAssistant(id: string): void {
  const row = getDb().prepare('SELECT is_default FROM assistants WHERE id = ?').get(id) as
    | { is_default: number }
    | undefined
  if (row?.is_default) {
    throw new AppError(ERROR_CODES.ASSISTANT_CANNOT_DELETE_DEFAULT)
  }
  getDb().prepare('DELETE FROM assistants WHERE id = ?').run(id)
}

export function reorderAssistants(ids: string[]): void {
  const db = getDb()
  const query = db.prepare('SELECT sort_order, is_default FROM assistants WHERE id = ?')
  const update = db.prepare('UPDATE assistants SET sort_order = ? WHERE id = ?')

  db.transaction(() => {
    const pinned: string[] = []
    const unpinned: string[] = []

    for (const id of ids) {
      const row = query.get(id) as { sort_order: number; is_default: number } | undefined
      if (!row) continue
      if (row.sort_order < 0 && !row.is_default) {
        pinned.push(id)
      } else {
        unpinned.push(id)
      }
    }

    pinned.forEach((id, i) => update.run(-(pinned.length - i), id))
    unpinned.forEach((id, i) => update.run(i, id))
  })()
}
