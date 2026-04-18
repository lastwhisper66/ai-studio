import i18next, { type i18n as I18n } from 'i18next'
import en from '../renderer/src/i18n/locales/en.json'
import zhCN from '../renderer/src/i18n/locales/zh-CN.json'
import { getSetting } from './db'

const SUPPORTED = ['en', 'zh-CN'] as const
export type SupportedLanguage = (typeof SUPPORTED)[number]
const DEFAULT_LANG: SupportedLanguage = 'en'

export const LANGUAGE_SETTING_KEY = 'general.language'

function normalize(lang: string | undefined | null): SupportedLanguage {
  if (!lang) return DEFAULT_LANG
  if ((SUPPORTED as readonly string[]).includes(lang)) return lang as SupportedLanguage
  // Coarse match: 'zh' / 'zh-TW' → 'zh-CN'; anything else → 'en'
  if (lang.toLowerCase().startsWith('zh')) return 'zh-CN'
  return 'en'
}

let instance: I18n | null = null

export async function initMainI18n(): Promise<void> {
  const stored = (() => {
    try {
      return getSetting(LANGUAGE_SETTING_KEY)
    } catch {
      return undefined
    }
  })()
  const lang = normalize(stored)
  instance = i18next.createInstance()
  await instance.init({
    lng: lang,
    fallbackLng: 'en',
    showSupportNotice: false,
    resources: {
      en: { translation: en },
      'zh-CN': { translation: zhCN },
    },
    interpolation: { escapeValue: false },
  })
}

export function setMainLanguage(lang: string): void {
  if (!instance) return
  instance.changeLanguage(normalize(lang))
}

export function onLanguageChange(handler: (lang: string) => void): () => void {
  if (!instance) return () => {}
  instance.on('languageChanged', handler)
  return () => instance?.off('languageChanged', handler)
}

export function t(key: string, params?: Record<string, string | number>): string {
  if (!instance) return key
  return instance.t(key, params ?? {})
}
