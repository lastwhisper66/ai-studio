import { createHighlighter, type Highlighter } from 'shiki'

const PRELOADED_LANGS = [
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

const THEMES = ['github-dark', 'github-light'] as const

let highlighterPromise: Promise<Highlighter> | null = null

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [...THEMES],
      langs: [...PRELOADED_LANGS],
    })
  }
  return highlighterPromise
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
    try {
      await highlighter.loadLanguage(resolvedLang as Parameters<Highlighter['loadLanguage']>[0])
    } catch {
      resolvedLang = 'text'
      if (!loadedLangs.includes('text')) {
        await highlighter.loadLanguage('text')
      }
    }
  }

  return highlighter.codeToHtml(code, { lang: resolvedLang, theme })
}
