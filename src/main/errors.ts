import type { LocalizedError } from '@shared/errors'
import { ERROR_CODES } from '@shared/errors'

/**
 * Error thrown from main-process code paths that will be surfaced to the UI.
 * Carries an i18n `code` + optional interpolation `params` instead of a
 * hard-coded user-facing string.
 */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly params?: Record<string, string | number>,
    fallbackMessage?: string,
  ) {
    super(fallbackMessage ?? code)
    this.name = 'AppError'
  }

  toLocalized(): LocalizedError {
    return { code: this.code, params: this.params, message: this.message }
  }
}

/**
 * Scrub obviously-sensitive substrings out of an upstream error message before
 * handing it to the renderer. Third-party SDKs (OpenAI, fetch) occasionally
 * echo the failing request — which may contain API keys or auth headers — into
 * the error's `.message`. Narrow regexes only; we'd rather keep a useful
 * diagnostic than aggressively nuke the text.
 */
function redactSensitive(input: string): string {
  return input
    .replace(/sk-[A-Za-z0-9_-]{16,}/g, 'sk-***')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer ***')
    .replace(/(api[_-]?key\s*[:=]\s*)([^\s,"']+)/gi, '$1***')
    .slice(0, 500)
}

/**
 * Normalize any caught value into a LocalizedError for IPC return.
 * Unknown errors are mapped to `errors.internal` with their (redacted) original
 * message preserved in `params.message` so the renderer can still show
 * something useful.
 */
export function toLocalizedError(err: unknown): LocalizedError {
  if (err instanceof AppError) return err.toLocalized()
  const raw = err instanceof Error ? err.message : String(err)
  const message = redactSensitive(raw)
  return {
    code: ERROR_CODES.INTERNAL,
    params: { message },
    message,
  }
}
