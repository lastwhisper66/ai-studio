/**
 * Structural fields owned by the app. User-supplied extra params can never
 * overwrite these — doing so would break the request shape (e.g. replacing
 * `messages`, or flipping `stream` to false and killing the stream loop).
 *
 * Union across all four SDKs: `model`/`messages`/`stream` (OpenAI, Claude),
 * `input` (Responses), `contents`/`config` (Gemini). For Gemini the extra
 * params merge *into* `config`, so locking `config` prevents replacing the
 * whole object rather than adding to it. `abortSignal` is also a field inside
 * that same Gemini `config` object (the real `AbortSignal` used to cancel the
 * stream) — locking it stops a user param from silently breaking the stop
 * button.
 */
export const LOCKED_PARAM_KEYS = [
  'model',
  'messages',
  'stream',
  'contents',
  'config',
  'input',
  'abortSignal',
] as const
