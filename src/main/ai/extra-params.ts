import { LOCKED_PARAM_KEYS } from '@shared/locked-param-keys'

/**
 * Merge user-supplied extra request params over a base params object.
 *
 * - keys in `LOCKED_PARAM_KEYS` are dropped
 * - a `null` value *deletes* the key from the result (needed for gateways that
 *   reject a param the app would otherwise always send, e.g. a gateway that
 *   400s on `max_completion_tokens`)
 * - everything else overwrites the base value
 *
 * Returns a new object; `base` is not mutated.
 */
export function applyExtraParams<T extends Record<string, unknown>>(
  base: T,
  extraParams?: Record<string, unknown>,
): T {
  if (!extraParams) return base

  const result: Record<string, unknown> = { ...base }

  for (const [key, value] of Object.entries(extraParams)) {
    if ((LOCKED_PARAM_KEYS as readonly string[]).includes(key)) continue
    if (value === null) {
      delete result[key]
      continue
    }
    result[key] = value
  }

  return result as T
}
