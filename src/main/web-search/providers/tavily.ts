import type { WebSearchResult } from '@shared/types'
import { AppError } from '../../errors'
import { ERROR_CODES } from '@shared/errors'

interface TavilyApiResponse {
  results?: Array<{
    title?: string
    url?: string
    content?: string
    score?: number
  }>
}

export interface SearchArgs {
  query: string
  maxResults: number
  apiKey: string
  signal: AbortSignal
  timeoutMs: number
}

const MAX_SNIPPET_LEN = 500

function sanitizeSnippet(value: string | undefined): string {
  if (!value) return ''
  // Strip C0 control chars except \n; collapse whitespace; trim.
  const cleaned = value
    .replace(/[\x00-\x09\x0B-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.length > MAX_SNIPPET_LEN ? cleaned.slice(0, MAX_SNIPPET_LEN) + '…' : cleaned
}

export async function searchTavily(args: SearchArgs): Promise<WebSearchResult[]> {
  if (!args.apiKey) {
    throw new AppError(ERROR_CODES.WEB_SEARCH_API_KEY_MISSING, { provider: 'Tavily' })
  }
  const combined = AbortSignal.any([args.signal, AbortSignal.timeout(args.timeoutMs)])
  let response: Response
  try {
    response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: combined,
      body: JSON.stringify({
        api_key: args.apiKey,
        query: args.query,
        max_results: args.maxResults,
        search_depth: 'basic',
      }),
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new AppError(ERROR_CODES.WEB_SEARCH_TIMEOUT, { provider: 'Tavily' })
    }
    throw new AppError(ERROR_CODES.WEB_SEARCH_REQUEST_FAILED, {
      provider: 'Tavily',
      message: err instanceof Error ? err.message : String(err),
    })
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new AppError(ERROR_CODES.WEB_SEARCH_REQUEST_FAILED, {
      provider: 'Tavily',
      message: `HTTP ${response.status}: ${body.slice(0, 200)}`,
    })
  }
  const data = (await response.json()) as TavilyApiResponse
  const results = (data.results ?? []).slice(0, args.maxResults)
  return results.map((r, i) => ({
    index: i + 1,
    title: r.title ?? r.url ?? '(no title)',
    url: r.url ?? '',
    snippet: sanitizeSnippet(r.content),
    score: r.score,
  }))
}
