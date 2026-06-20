import { countTokens as countO200kTokens } from 'gpt-tokenizer'
import { countTokens as countCl100kTokens } from 'gpt-tokenizer/encoding/cl100k_base'
import type { Message } from '@shared/types'

type EncodingName = 'o200k_base' | 'cl100k_base'

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

export function countContextTokens(args: {
  messages: Pick<Message, 'id' | 'content'>[]
  systemPrompt?: string | null
  model?: string | null
}): number {
  const { messages, systemPrompt, model } = args
  let total = countTokens(systemPrompt, model)
  for (const message of messages) {
    total += countTokens(message.content, model)
  }
  return total
}
