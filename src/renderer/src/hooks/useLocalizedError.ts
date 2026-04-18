import { useTranslation } from 'react-i18next'
import type { LocalizedError } from '@shared/errors'

/**
 * Resolve a `LocalizedError` (or legacy string) to a user-facing message.
 * Returns an empty string for null / undefined so components can safely use
 * the result directly in JSX without extra guards.
 */
export function useLocalizedError(): (err: LocalizedError | string | null | undefined) => string {
  const { t } = useTranslation()
  return (err) => {
    if (!err) return ''
    if (typeof err === 'string') return err
    return t(err.code, err.params ?? {}) as string
  }
}
