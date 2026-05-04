import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { LocalizedError } from '@shared/errors'

/**
 * Resolve a `LocalizedError` (or legacy string) to a user-facing message.
 * Returns an empty string for null / undefined so components can safely use
 * the result directly in JSX without extra guards.
 *
 * The returned callback is memoized against the i18next `t` function so its
 * identity stays stable across renders. Components depend on this when they
 * use `localizedError` inside `useEffect` dependency arrays — without the
 * memoization, a new function on every render would re-fire the effect every
 * render and produce infinite loops (the bug previously seen on the local
 * rollback dialog where it appeared to be permanently "loading").
 */
export function useLocalizedError(): (err: LocalizedError | string | null | undefined) => string {
  const { t } = useTranslation()
  return useCallback(
    (err) => {
      if (!err) return ''
      if (typeof err === 'string') return err
      return t(err.code, err.params ?? {}) as string
    },
    [t],
  )
}
