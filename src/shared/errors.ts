/**
 * Localized error protocol shared between main and renderer processes.
 *
 * Main process throws / returns `LocalizedError` objects (never raw English
 * or Chinese strings). The renderer translates them via `useLocalizedError`
 * / i18next when displaying.
 */

export interface LocalizedError {
  /** i18n key, e.g. 'errors.chat.providerNotFound' */
  code: string
  /** Interpolation parameters for the i18n template */
  params?: Record<string, string | number>
  /**
   * Fallback English message. Written to logs / kept as `message` on Error
   * instances so diagnostics remain readable if the key is unknown.
   */
  message?: string
}

export const ERROR_CODES = {
  // chat
  CHAT_CONVERSATION_NOT_FOUND: 'errors.chat.conversationNotFound',
  CHAT_RESEND_TARGET_NOT_FOUND: 'errors.chat.resendTargetNotFound',
  CHAT_NO_PROVIDER: 'errors.chat.noProvider',
  CHAT_PROVIDER_NOT_FOUND: 'errors.chat.providerNotFound',
  CHAT_API_KEY_MISSING: 'errors.chat.apiKeyMissing',
  CHAT_NO_MODEL: 'errors.chat.noModel',

  // selection assistant
  SELECTION_NO_MODEL: 'errors.selection.noModel',
  SELECTION_PROVIDER_NOT_FOUND: 'errors.selection.providerNotFound',
  SELECTION_API_KEY_MISSING: 'errors.selection.apiKeyMissing',
  SELECTION_NO_MODEL_SELECTED: 'errors.selection.noModelSelected',
  SELECTION_MODEL_UNAVAILABLE: 'errors.selection.modelUnavailable',
  SELECTION_ACTION_NOT_FOUND: 'errors.selection.actionNotFound',

  // quick assistant
  QUICK_NO_PROVIDER: 'errors.quickAssistant.noProvider',
  QUICK_PROVIDER_NOT_FOUND: 'errors.quickAssistant.providerNotFound',
  QUICK_API_KEY_MISSING: 'errors.quickAssistant.apiKeyMissing',
  QUICK_NO_MODEL: 'errors.quickAssistant.noModel',
  QUICK_MODEL_INVALID: 'errors.quickAssistant.modelInvalid',
  QUICK_ACTION_NOT_FOUND: 'errors.quickAssistant.actionNotFound',

  // translate
  TRANSLATE_NO_PROVIDER: 'errors.translate.noProvider',
  TRANSLATE_PROVIDER_NOT_FOUND: 'errors.translate.providerNotFound',
  TRANSLATE_API_KEY_MISSING: 'errors.translate.apiKeyMissing',
  TRANSLATE_NO_MODEL: 'errors.translate.noModel',
  TRANSLATE_MODEL_INVALID: 'errors.translate.modelInvalid',

  // provider connection test
  PROVIDER_CONNECTION_TIMEOUT: 'errors.provider.connectionTimeout',
  PROVIDER_CONNECTION_FAILED: 'errors.provider.connectionFailed',

  // model discovery
  MODEL_FETCH_FAILED: 'errors.model.fetchFailed',
  MODEL_FETCH_TIMEOUT: 'errors.model.fetchTimeout',

  // files
  FILE_TOO_LARGE: 'errors.file.tooLarge',
  FILE_INVALID_ATTACHMENT_PATH: 'errors.file.invalidAttachmentPath',
  FILE_ATTACHMENT_NOT_FOUND: 'errors.file.attachmentNotFound',

  // assistants / db
  ASSISTANT_CANNOT_DELETE_DEFAULT: 'errors.assistant.cannotDeleteDefault',
  MESSAGE_NOT_FOUND: 'errors.message.notFound',
  DB_NOT_INITIALIZED: 'errors.db.notInitialized',

  // fallback
  INTERNAL: 'errors.internal',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

/**
 * Build an `errors.internal` LocalizedError from a plain message. Shared
 * helper used by renderer stores for the rare "IPC reported failure but no
 * error payload" path.
 */
export function fallbackLocalizedError(message: string): LocalizedError {
  return { code: ERROR_CODES.INTERNAL, params: { message }, message }
}
