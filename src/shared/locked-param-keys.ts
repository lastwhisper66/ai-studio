/**
 * Structural fields owned by the app. User-supplied extra params can never
 * overwrite these — doing so would break the request shape (e.g. replacing
 * `messages`, or flipping `stream` to false and killing the stream loop).
 *
 * Union across all four SDKs: `model`/`messages`/`stream` (OpenAI, Claude),
 * `input` (Responses), `contents`/`config` (Gemini). For Gemini the extra
 * params merge *into* `config`, so locking `config` prevents replacing the
 * whole object rather than adding to it.
 */
export const LOCKED_PARAM_KEYS = [
  'model',
  'messages',
  'stream',
  'contents',
  'config',
  'input',
] as const
