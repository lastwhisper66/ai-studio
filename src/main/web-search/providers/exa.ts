import type { WebSearchResult } from '@shared/types'
import { AppError } from '../../errors'
import { ERROR_CODES } from '@shared/errors'

interface ExaApiResponse {
  results?: Array<{
    title?: string
    url?: string
    text?: string
    score?: number
  }>
}

export interface ExaSearchArgs {
  query: string
  maxResults: number
  apiKey: string
  signal: AbortSignal
  timeoutMs: number
}

const MAX_SNIPPET_LEN = 500

function sanitizeSnippet(value: string | undefined): string {
  if (!value) return ''
  const cleaned = value
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x09\x0B-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.length > MAX_SNIPPET_LEN ? cleaned.slice(0, MAX_SNIPPET_LEN) + '…' : cleaned
}

export async function searchExa(args: ExaSearchArgs): Promise<WebSearchResult[]> {
  if (!args.apiKey) {
    throw new AppError(ERROR_CODES.WEB_SEARCH_API_KEY_MISSING, { provider: 'Exa' })
  }
  const combined = AbortSignal.any([args.signal, AbortSignal.timeout(args.timeoutMs)])
  let response: Response
  try {
    response = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': args.apiKey,
      },
      signal: combined,
      body: JSON.stringify({
        query: args.query,
        numResults: args.maxResults,
        contents: { text: { maxCharacters: MAX_SNIPPET_LEN } },
      }),
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new AppError(ERROR_CODES.WEB_SEARCH_TIMEOUT, { provider: 'Exa' })
    }
    throw new AppError(ERROR_CODES.WEB_SEARCH_REQUEST_FAILED, {
      provider: 'Exa',
      message: err instanceof Error ? err.message : String(err),
    })
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new AppError(ERROR_CODES.WEB_SEARCH_REQUEST_FAILED, {
      provider: 'Exa',
      message: `HTTP ${response.status}: ${body.slice(0, 200)}`,
    })
  }
  const data = (await response.json()) as ExaApiResponse
  const results = (data.results ?? []).slice(0, args.maxResults)
  return results.map((r, i) => ({
    index: i + 1,
    title: r.title ?? r.url ?? '(no title)',
    url: r.url ?? '',
    snippet: sanitizeSnippet(r.text),
    score: r.score,
  }))
}
