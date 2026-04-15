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

export function generateTranslatePrompt(targetLangLabel: string): string {
  return `You are a professional translator. Translate the input text to ${targetLangLabel}. Only output the translation, nothing else. Preserve the original formatting and tone.`
}

export function generateImageTranslatePrompt(targetLangLabel: string): string {
  return `You are a professional translator. Translate the text or image content sent by the user to ${targetLangLabel}. Only output the translation, nothing else.`
}

export function getLanguageLabel(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code
}

export function getLanguageEnglishLabel(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.englishLabel ?? code
}
