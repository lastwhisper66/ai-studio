import { useTranslation } from 'react-i18next'

/**
 * Values persisted in SQLite for built-in seed rows are stored as i18n keys
 * (e.g. `seed.selectionActions.translate.name`) rather than localized text.
 * User-created rows keep plain text. We distinguish them by the `seed.`
 * prefix — once a user edits a built-in name, it loses the prefix and we
 * stop translating it.
 */
export function maybeTranslateSeed(
  value: string | undefined | null,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (!value) return ''
  if (value.startsWith('seed.')) return t(value) as string
  return value
}

export function useSeedTranslator(): (value: string | undefined | null) => string {
  const { t } = useTranslation()
  return (value) => maybeTranslateSeed(value, t)
}
