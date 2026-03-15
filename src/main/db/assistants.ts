import { randomUUID } from 'crypto'
import type { Assistant } from '@shared/types'
import { getDb } from './database'

interface AssistantRow {
  id: string
  name: string
  description: string
  system_prompt: string
  provider_id: string | null
  model: string
  temperature: string
  max_tokens: string
  prompt_suggestions: string
  emoji: string
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
    description: row.description,
    systemPrompt: row.system_prompt,
    providerId: row.provider_id,
    model: row.model,
    temperature: row.temperature,
    maxTokens: row.max_tokens,
    promptSuggestions,
    emoji: row.emoji,
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
  description?: string
  systemPrompt?: string
  providerId?: string | null
  model?: string
  temperature?: string
  maxTokens?: string
  promptSuggestions?: string[]
  emoji?: string
  sortOrder?: number
}

export function createAssistant(data: CreateAssistantData): Assistant {
  const id = randomUUID()
  const promptSuggestions = JSON.stringify(data.promptSuggestions ?? [])
  getDb()
    .prepare(
      `INSERT INTO assistants (id, name, description, system_prompt, provider_id, model, temperature, max_tokens, prompt_suggestions, emoji, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      data.name,
      data.description ?? '',
      data.systemPrompt ?? '',
      data.providerId ?? null,
      data.model ?? '',
      data.temperature ?? '',
      data.maxTokens ?? '',
      promptSuggestions,
      data.emoji ?? '🤖',
      data.sortOrder ?? 0,
    )
  return getAssistant(id)!
}

export interface UpdateAssistantData {
  name?: string
  description?: string
  systemPrompt?: string
  providerId?: string | null
  model?: string
  temperature?: string
  maxTokens?: string
  promptSuggestions?: string[]
  emoji?: string
  sortOrder?: number
}

export function updateAssistant(id: string, data: UpdateAssistantData): Assistant | undefined {
  const fields: string[] = []
  const values: unknown[] = []

  if (data.name !== undefined) {
    fields.push('name = ?')
    values.push(data.name)
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
  if (data.maxTokens !== undefined) {
    fields.push('max_tokens = ?')
    values.push(data.maxTokens)
  }
  if (data.promptSuggestions !== undefined) {
    fields.push('prompt_suggestions = ?')
    values.push(JSON.stringify(data.promptSuggestions))
  }
  if (data.emoji !== undefined) {
    fields.push('emoji = ?')
    values.push(data.emoji)
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
  getDb().prepare('DELETE FROM assistants WHERE id = ?').run(id)
}
