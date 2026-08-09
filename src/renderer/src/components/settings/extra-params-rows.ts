export interface ParamRow {
  key: string
  value: string
}

/**
 * Render a stored params object as editable rows. Values are JSON-stringified
 * so the round-trip is lossless: a string value shows as `"foo"` (quoted) and
 * re-parses back to a string. Rendering strings unquoted would make the string
 * `"4096"` come back as the number 4096.
 */
export function rowsFromParams(params: Record<string, unknown>): ParamRow[] {
  return Object.entries(params).map(([key, value]) => ({
    key,
    value: JSON.stringify(value) ?? '',
  }))
}

/**
 * Collapse rows back into the stored object. Empty keys are dropped. Each value
 * is parsed as JSON when possible, otherwise kept as a raw string — so `4096`
 * becomes a number, `false` a boolean, `null` the delete sentinel, and
 * `gpt-4o` the string "gpt-4o".
 */
export function paramsFromRows(rows: ParamRow[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const row of rows) {
    const key = row.key.trim()
    if (!key) continue
    try {
      out[key] = JSON.parse(row.value) as unknown
    } catch {
      out[key] = row.value
    }
  }
  return out
}

/** Keys appearing more than once (after trimming), ignoring empty keys. */
export function duplicateKeys(rows: ParamRow[]): Set<string> {
  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const row of rows) {
    const key = row.key.trim()
    if (!key) continue
    if (seen.has(key)) dupes.add(key)
    seen.add(key)
  }
  return dupes
}
