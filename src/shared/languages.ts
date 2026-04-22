export interface Language {
  code: string
  label: string
  englishLabel: string
}

export const LANGUAGES: Language[] = [
  { code: 'zh-CN', label: '简体中文', englishLabel: 'Simplified Chinese' },
  { code: 'en', label: 'English', englishLabel: 'English' },
  { code: 'ja', label: '日本語', englishLabel: 'Japanese' },
]

/**
 * Sentinel value for the "no target-language override" option in quick
 * assistant / selection bubble dropdowns. When selected, callers skip the
 * `Please respond in X.` append and let the action's stored prompt run as-is.
 */
export const TARGET_LANG_OFF = 'off'

export function getLanguageLabel(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code
}

export function getLanguageEnglishLabel(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.englishLabel ?? code
}

/**
 * Map an arbitrary locale code (e.g. i18n.language) to a LANGUAGES entry,
 * or pass through the `off` sentinel when the user has disabled the override.
 * Falls back to the first LANGUAGES entry (or 'en') if no match is found.
 */
export function normalizeLangCode(input: string | undefined): string {
  if (!input) return LANGUAGES[0]?.code ?? 'en'
  if (input === TARGET_LANG_OFF) return TARGET_LANG_OFF
  if (LANGUAGES.some((l) => l.code === input)) return input
  // Try the primary subtag: "en-US" -> "en", or "zh" -> "zh-CN" when only a
  // region-tagged entry exists.
  const primary = input.split('-')[0]
  const match = LANGUAGES.find((l) => l.code === primary || l.code.startsWith(`${primary}-`))
  return match?.code ?? LANGUAGES[0]?.code ?? 'en'
}
