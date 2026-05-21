import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { AppError } from '../errors'
import { ERROR_CODES } from '@shared/errors'
import { runUtilityCompletion } from '../utility-llm'

const REWRITE_SYSTEM_PROMPT = `You are a query-rewriting assistant for a web search tool.
Read the recent conversation and produce a single, self-contained web search query that captures
what the user is asking about in the most recent message. Resolve pronouns and references to prior
context. Output ONLY the query string on one line. Do not explain. Do not add quotes.`

const RECENT_MESSAGE_LIMIT = 4

/**
 * Collapse the recent conversation context into a single web-search query.
 * Throws WEB_SEARCH_REWRITE_FAILED on any failure (timeout, no utility model,
 * network error). Callers should catch and fall back to the raw user text.
 */
export async function rewriteQuery(
  conversationContext: ChatCompletionMessageParam[],
  signal: AbortSignal,
): Promise<string> {
  // Take the most recent user/assistant turns. Drop systems entirely.
  const recent = conversationContext
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-RECENT_MESSAGE_LIMIT)

  if (recent.length === 0) {
    throw new AppError(ERROR_CODES.WEB_SEARCH_REWRITE_FAILED, { reason: 'no-context' })
  }

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: REWRITE_SYSTEM_PROMPT },
    ...(recent.map((m) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : extractText(m.content),
    })) as ChatCompletionMessageParam[]),
  ]

  try {
    const raw = await runUtilityCompletion({
      task: 'search-rewrite',
      messages,
      signal,
      timeoutMs: 10_000,
      temperature: 0.3,
      maxCompletionTokens: 100,
    })
    const cleaned = raw
      .replace(/\r?\n.*$/s, '')
      .trim()
      .replace(/^["']|["']$/g, '')
    if (!cleaned) {
      throw new AppError(ERROR_CODES.WEB_SEARCH_REWRITE_FAILED, { reason: 'empty-output' })
    }
    return cleaned
  } catch (err) {
    if (err instanceof AppError) throw err
    throw new AppError(ERROR_CODES.WEB_SEARCH_REWRITE_FAILED, {
      reason: err instanceof Error ? err.message : String(err),
    })
  }
}

/**
 * If the OpenAI multi-part content array sneaks in (vision messages), fall
 * back to concatenating the text parts so we don't lose context.
 */
function extractText(content: unknown): string {
  if (!Array.isArray(content)) return ''
  const out: string[] = []
  for (const part of content as Array<{ type?: string; text?: string }>) {
    if (part.type === 'text' && typeof part.text === 'string') out.push(part.text)
  }
  return out.join(' ')
}
