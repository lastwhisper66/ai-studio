import type { WebSearchResult } from '@shared/types'
import { AppError } from '../../errors'
import { ERROR_CODES } from '@shared/errors'

interface SearxngApiResponse {
  results?: Array<{
    title?: string
    url?: string
    content?: string
  }>
}

export interface SearxngSearchArgs {
  query: string
  maxResults: number
  url: string
  username?: string
  password?: string
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

export async function searchSearxng(args: SearxngSearchArgs): Promise<WebSearchResult[]> {
  if (!args.url) {
    throw new AppError(ERROR_CODES.WEB_SEARCH_API_KEY_MISSING, { provider: 'SearXNG' })
  }
  const combined = AbortSignal.any([args.signal, AbortSignal.timeout(args.timeoutMs)])
  const trimmedBase = args.url.replace(/\/+$/, '')
  const reqUrl = new URL(`${trimmedBase}/search`)
  reqUrl.searchParams.set('q', args.query)
  reqUrl.searchParams.set('format', 'json')

  const headers: Record<string, string> = { accept: 'application/json' }
  if (args.username && args.password) {
    headers.authorization =
      'Basic ' + Buffer.from(`${args.username}:${args.password}`).toString('base64')
  }

  let response: Response
  try {
    response = await fetch(reqUrl, { headers, signal: combined })
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new AppError(ERROR_CODES.WEB_SEARCH_TIMEOUT, { provider: 'SearXNG' })
    }
    throw new AppError(ERROR_CODES.WEB_SEARCH_REQUEST_FAILED, {
      provider: 'SearXNG',
      message: err instanceof Error ? err.message : String(err),
    })
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new AppError(ERROR_CODES.WEB_SEARCH_REQUEST_FAILED, {
      provider: 'SearXNG',
      message: `HTTP ${response.status}: ${body.slice(0, 200)}`,
    })
  }
  const data = (await response.json()) as SearxngApiResponse
  const results = (data.results ?? []).slice(0, args.maxResults)
  return results.map((r, i) => ({
    index: i + 1,
    title: r.title ?? r.url ?? '(no title)',
    url: r.url ?? '',
    snippet: sanitizeSnippet(r.content),
  }))
}
