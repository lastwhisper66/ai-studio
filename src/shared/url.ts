import type { ProviderType } from './types'

/** Return the default API path suffix for a given provider type. */
export function getDefaultApiPath(provider: ProviderType): string {
  if (provider === 'azure') return '/openai/v1'
  if (provider === 'fujitsu') return ''
  if (provider === 'gemini') return '/v1beta'
  if (provider === 'claude') return ''
  return '/v1'
}

/**
 * For providers that require the model name in the URL path (e.g. Fujitsu),
 * append the model segment to the base URL if not already present.
 */
export function buildProviderBaseUrl(
  baseUrl: string,
  provider: ProviderType,
  model: string,
): string {
  if (provider !== 'fujitsu' || !model) return baseUrl
  return baseUrl.replace(/\/+$/, '') + '/' + model
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
