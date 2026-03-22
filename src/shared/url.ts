import type { ProviderType } from './types'

/** Return the default API path suffix for a given provider type. */
export function getDefaultApiPath(_provider: ProviderType): string {
  return '/v1'
}

/**
 * Normalize a base URL by auto-appending the provider's standard API path
 * when the user only entered a domain (no path component).
 *
 * Examples:
 *   "https://api.openai.com"       → "https://api.openai.com/v1"
 *   "https://api.openai.com/v1"    → "https://api.openai.com/v1"  (unchanged)
 *   "https://gen...googleapis.com" → "https://gen...googleapis.com/v1beta/openai"
 */
export function normalizeBaseUrl(baseUrl: string, provider: ProviderType): string {
  const trimmed = baseUrl.replace(/\/+$/, '')
  try {
    const parsed = new URL(trimmed)
    if (parsed.pathname === '/' || parsed.pathname === '') {
      return trimmed + getDefaultApiPath(provider)
    }
  } catch {
    // invalid URL — return as-is
  }
  return trimmed
}
