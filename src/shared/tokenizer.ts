import { countTokens as countO200kTokens } from 'gpt-tokenizer'
import { countTokens as countCl100kTokens } from 'gpt-tokenizer/encoding/cl100k_base'
import type { ContextTokenUsage, Message } from './types'

type EncodingName = 'o200k_base' | 'cl100k_base'

export type ContextTokenBreakdown = ContextTokenUsage

export interface CountableContentPart {
  type?: string
  text?: unknown
}

export type CountableMessageContent = string | readonly CountableContentPart[] | null | undefined

const MAX_CACHE_ENTRIES = 1000
const tokenCountCache = new Map<string, number>()

function normalizeModel(model?: string | null): string {
  return (model ?? '').trim().toLowerCase()
}

export function encodingForModel(model?: string | null): EncodingName {
  const normalized = normalizeModel(model)
  if (
    normalized.includes('gpt-3.5') ||
    /^gpt-4(?!o|\.1)/.test(normalized) ||
    normalized.includes('embedding')
  ) {
    return 'cl100k_base'
  }
  return 'o200k_base'
}

function remember(cacheKey: string, count: number): number {
  tokenCountCache.set(cacheKey, count)
  if (tokenCountCache.size > MAX_CACHE_ENTRIES) {
    const first = tokenCountCache.keys().next().value
    if (first) tokenCountCache.delete(first)
  }
  return count
}

export function countTokens(text: string | null | undefined, model?: string | null): number {
  if (!text) return 0
  const encoding = encodingForModel(model)
  const cacheKey = `${encoding}:${text.length}:${text}`
  const cached = tokenCountCache.get(cacheKey)
  if (cached !== undefined) return cached
  const count = encoding === 'cl100k_base' ? countCl100kTokens(text) : countO200kTokens(text)
  return remember(cacheKey, count)
}

export function countContentTokens(
  content: CountableMessageContent,
  model?: string | null,
): number {
  if (typeof content === 'string') return countTokens(content, model)
  if (!Array.isArray(content)) return 0

  let total = 0
  for (const part of content) {
    if (part.type === 'text' && typeof part.text === 'string') {
      total += countTokens(part.text, model)
    }
  }
  return total
}

export function countMessagesTokens(
  messages: Pick<Message, 'id' | 'content'>[],
  model?: string | null,
): number {
  let total = 0
  for (const message of messages) {
    total += countTokens(message.content, model)
  }
  return total
}

export function countContextTokens(args: {
  messages: Pick<Message, 'id' | 'content'>[]
  systemPrompt?: string | null
  model?: string | null
}): number {
  const { messages, systemPrompt, model } = args
  return countTokens(systemPrompt, model) + countMessagesTokens(messages, model)
}
