// Re-export everything from the shared module so existing renderer imports
// continue to work. The canonical definitions now live in src/shared/languages.ts.
export {
  LANGUAGES,
  generateTranslatePrompt,
  generateImageTranslatePrompt,
  getLanguageLabel,
  getLanguageEnglishLabel,
} from '@shared/languages'
export type { Language } from '@shared/languages'
