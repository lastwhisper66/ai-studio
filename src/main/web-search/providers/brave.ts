import type { WebSearchResult } from '@shared/types'
import { AppError } from '../../errors'
import { ERROR_CODES } from '@shared/errors'

interface BraveApiResponse {
  web?: {
    results?: Array<{
      title?: string
      url?: string
      description?: string
    }>
  }
}

export interface BraveSearchArgs {
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

export async function searchBrave(args: BraveSearchArgs): Promise<WebSearchResult[]> {
  if (!args.apiKey) {
    throw new AppError(ERROR_CODES.WEB_SEARCH_API_KEY_MISSING, { provider: 'Brave' })
  }
  const combined = AbortSignal.any([args.signal, AbortSignal.timeout(args.timeoutMs)])
  const url = new URL('https://api.search.brave.com/res/v1/web/search')
  url.searchParams.set('q', args.query)
  url.searchParams.set('count', String(args.maxResults))
  let response: Response
  try {
    response = await fetch(url, {
      headers: {
        accept: 'application/json',
        'x-subscription-token': args.apiKey,
      },
      signal: combined,
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new AppError(ERROR_CODES.WEB_SEARCH_TIMEOUT, { provider: 'Brave' })
    }
    throw new AppError(ERROR_CODES.WEB_SEARCH_REQUEST_FAILED, {
      provider: 'Brave',
      message: err instanceof Error ? err.message : String(err),
    })
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new AppError(ERROR_CODES.WEB_SEARCH_REQUEST_FAILED, {
      provider: 'Brave',
      message: `HTTP ${response.status}: ${body.slice(0, 200)}`,
    })
  }
  const data = (await response.json()) as BraveApiResponse
  const results = (data.web?.results ?? []).slice(0, args.maxResults)
  return results.map((r, i) => ({
    index: i + 1,
    title: r.title ?? r.url ?? '(no title)',
    url: r.url ?? '',
    snippet: sanitizeSnippet(r.description),
  }))
}
