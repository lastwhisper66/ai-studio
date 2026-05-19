import type { WebSearchProviderType, WebSearchResult, WebSearchTestPayload } from '@shared/types'
import { AppError } from '../errors'
import { ERROR_CODES } from '@shared/errors'
import { getSetting } from '../db/settings'
import { searchTavily } from './providers/tavily'
import { searchBrave } from './providers/brave'
import { searchSearxng } from './providers/searxng'

export interface WebSearchSettings {
  enabled: boolean
  provider: WebSearchProviderType
  tavilyApiKey: string
  braveApiKey: string
  exaApiKey: string
  searxngUrl: string
  searxngUsername: string
  searxngApiKey: string
  maxResults: number
  rewriteQuery: boolean
  timeoutMs: number
}

export function loadWebSearchSettings(): WebSearchSettings {
  return {
    enabled: getSetting('webSearch.enabled') === 'true',
    provider: (getSetting('webSearch.provider') as WebSearchProviderType) || 'tavily',
    tavilyApiKey: getSetting('webSearch.tavilyApiKey') ?? '',
    braveApiKey: getSetting('webSearch.braveApiKey') ?? '',
    exaApiKey: getSetting('webSearch.exaApiKey') ?? '',
    searxngUrl: getSetting('webSearch.searxngUrl') ?? '',
    searxngUsername: getSetting('webSearch.searxngUsername') ?? '',
    searxngApiKey: getSetting('webSearch.searxngApiKey') ?? '',
    maxResults: parseInt(getSetting('webSearch.maxResults') ?? '5', 10) || 5,
    rewriteQuery: (getSetting('webSearch.rewriteQuery') ?? 'true') === 'true',
    timeoutMs: parseInt(getSetting('webSearch.timeoutMs') ?? '15000', 10) || 15000,
  }
}

export function isProviderConfigured(settings: WebSearchSettings): boolean {
  switch (settings.provider) {
    case 'tavily':
      return settings.tavilyApiKey.length > 0
    case 'brave':
      return settings.braveApiKey.length > 0
    case 'exa':
      return settings.exaApiKey.length > 0
    case 'searxng':
      return settings.searxngUrl.length > 0
    default:
      return false
  }
}

export interface RunWebSearchArgs {
  query: string
  signal: AbortSignal
}

const MAX_QUERY_LEN = 500

function clampQuery(q: string): string {
  const trimmed = q.trim().replace(/\s+/g, ' ')
  return trimmed.length > MAX_QUERY_LEN ? trimmed.slice(0, MAX_QUERY_LEN) : trimmed
}

/**
 * Run a web search using the user-configured provider. Throws AppError on
 * failure — the caller decides whether to degrade or surface.
 */
export async function runWebSearch(args: RunWebSearchArgs): Promise<WebSearchResult[]> {
  const settings = loadWebSearchSettings()
  if (!isProviderConfigured(settings)) {
    throw new AppError(ERROR_CODES.WEB_SEARCH_NOT_CONFIGURED, { provider: settings.provider })
  }
  const query = clampQuery(args.query)
  switch (settings.provider) {
    case 'tavily':
      return searchTavily({
        query,
        maxResults: settings.maxResults,
        apiKey: settings.tavilyApiKey,
        signal: args.signal,
        timeoutMs: settings.timeoutMs,
      })
    case 'brave':
      return searchBrave({
        query,
        maxResults: settings.maxResults,
        apiKey: settings.braveApiKey,
        signal: args.signal,
        timeoutMs: settings.timeoutMs,
      })
    case 'searxng':
      return searchSearxng({
        query,
        maxResults: settings.maxResults,
        url: settings.searxngUrl,
        username: settings.searxngUsername || undefined,
        password: settings.searxngApiKey || undefined,
        signal: args.signal,
        timeoutMs: settings.timeoutMs,
      })
    default:
      throw new AppError(ERROR_CODES.WEB_SEARCH_NOT_CONFIGURED, { provider: settings.provider })
  }
}

/**
 * Used by the test-connection IPC handler. Does not read settings; uses
 * the credentials in the payload directly.
 */
export async function runProviderSearchDirect(
  payload: WebSearchTestPayload & {
    query: string
    maxResults: number
    signal: AbortSignal
    timeoutMs: number
  },
): Promise<WebSearchResult[]> {
  switch (payload.provider) {
    case 'tavily':
      return searchTavily({
        query: payload.query,
        maxResults: payload.maxResults,
        apiKey: payload.apiKey ?? '',
        signal: payload.signal,
        timeoutMs: payload.timeoutMs,
      })
    case 'brave':
      return searchBrave({
        query: payload.query,
        maxResults: payload.maxResults,
        apiKey: payload.apiKey ?? '',
        signal: payload.signal,
        timeoutMs: payload.timeoutMs,
      })
    case 'searxng':
      return searchSearxng({
        query: payload.query,
        maxResults: payload.maxResults,
        url: payload.searxngUrl ?? '',
        username: payload.searxngAuthUser,
        password: payload.searxngAuthPass,
        signal: payload.signal,
        timeoutMs: payload.timeoutMs,
      })
    default:
      throw new AppError(ERROR_CODES.WEB_SEARCH_NOT_CONFIGURED, { provider: payload.provider })
  }
}

export { buildSearchContextMessage } from './context-builder'
