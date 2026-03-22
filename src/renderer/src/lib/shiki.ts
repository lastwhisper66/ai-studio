import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import { bundledThemes } from 'shiki/themes'
import { bundledLanguages } from 'shiki/langs'
import type { HighlighterCore } from 'shiki'

const PRELOADED_LANG_KEYS = [
  'javascript',
  'typescript',
  'python',
  'json',
  'html',
  'css',
  'bash',
  'markdown',
  'sql',
  'jsx',
  'tsx',
] as const

type PreloadedLang = (typeof PRELOADED_LANG_KEYS)[number]

let highlighterPromise: Promise<HighlighterCore> | null = null

function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [bundledThemes['github-dark'], bundledThemes['github-light']],
      langs: PRELOADED_LANG_KEYS.map((k) => bundledLanguages[k as PreloadedLang]),
      engine: createJavaScriptRegexEngine(),
    }).catch((err) => {
      highlighterPromise = null
      throw err
    })
  }
  return highlighterPromise!
}

export async function highlightCode(
  code: string,
  lang: string,
  theme: 'github-dark' | 'github-light',
): Promise<string> {
  const highlighter = await getHighlighter()
  const loadedLangs = highlighter.getLoadedLanguages()

  let resolvedLang = lang.toLowerCase()

  if (!loadedLangs.includes(resolvedLang)) {
    const langKey = resolvedLang as keyof typeof bundledLanguages
    if (bundledLanguages[langKey]) {
      try {
        await highlighter.loadLanguage(bundledLanguages[langKey])
      } catch {
        resolvedLang = 'text'
      }
    } else {
      resolvedLang = 'text'
    }
  }

  return highlighter.codeToHtml(code, { lang: resolvedLang, theme })
}
