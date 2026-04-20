/**
 * Shared constants and helpers for the Quick Assistant's built-in translate
 * actions. Text and image translate keep independent target-language settings,
 * so callers need a single source of truth for the setting keys and the
 * id-to-key mapping.
 */

export const BUILTIN_TRANSLATE_ID = 'builtin-translate'
export const BUILTIN_IMAGE_TRANSLATE_ID = 'builtin-image-translate'

export const TEXT_TRANSLATE_LANG_KEY = 'quickAssistant.translateTargetLang'
export const IMAGE_TRANSLATE_LANG_KEY = 'quickAssistant.imageTranslateTargetLang'

/** Returns the settings key that stores the target language for the given action. */
export function getTranslateLangKey(actionId: string | undefined): string {
  return actionId === BUILTIN_IMAGE_TRANSLATE_ID
    ? IMAGE_TRANSLATE_LANG_KEY
    : TEXT_TRANSLATE_LANG_KEY
}

/**
 * Resolves the target language for a translate action. When the action's key
 * hasn't been set yet, falls back to the UI locale — not the other action's
 * key — so text and image translate stay truly independent.
 */
export function resolveTranslateTargetLang(
  actionId: string | undefined,
  settings: Record<string, string>,
  uiLocale: string,
): string {
  return settings[getTranslateLangKey(actionId)] || uiLocale || 'en'
}
