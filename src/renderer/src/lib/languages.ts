export interface Language {
  code: string
  label: string
}

export const LANGUAGES: Language[] = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
]

export function generateTranslatePrompt(targetLangLabel: string): string {
  return `You are a professional translator. Translate the input text to ${targetLangLabel}. Only output the translation, nothing else. Preserve the original formatting.`
}

export function getLanguageLabel(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code
}
