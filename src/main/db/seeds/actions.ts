export interface BuiltinActionSeed {
  id: string
  name: string
  description: string
  systemPrompt: string
  icon: string
  sortOrder: number
}

export const QUICK_ACTION_SEEDS: readonly BuiltinActionSeed[] = [
  {
    id: 'builtin-answer',
    name: 'seed.quickActions.answer.name',
    description: 'seed.quickActions.answer.description',
    systemPrompt:
      "You are a knowledgeable and helpful assistant. Answer the user's question clearly, accurately, and concisely.",
    icon: 'MessageCircle',
    sortOrder: 0,
  },
  {
    id: 'builtin-translate',
    name: 'seed.quickActions.translate.name',
    description: 'seed.quickActions.translate.description',
    systemPrompt:
      'You are a professional translator. Translate the input text into the language specified in the follow-up instruction. If the input is already in that language, output it unchanged. Only output the translation, nothing else. Preserve the original formatting and tone.',
    icon: 'Languages',
    sortOrder: 1,
  },
  {
    id: 'builtin-summary',
    name: 'seed.quickActions.summarize.name',
    description: 'seed.quickActions.summarize.description',
    systemPrompt:
      'You are a summarization expert. Provide a clear, concise summary that captures all key points of the input text. Use bullet points or structured format when it improves clarity.',
    icon: 'FileText',
    sortOrder: 2,
  },
  {
    id: 'builtin-image-translate',
    name: 'seed.quickActions.imageTranslate.name',
    description: 'seed.quickActions.imageTranslate.description',
    systemPrompt:
      'You are a professional translator. Translate the text or image content sent by the user into the language specified in the follow-up instruction. If the content is already in that language, output it unchanged. Only output the translation, nothing else.',
    icon: 'ScanText',
    sortOrder: 3,
  },
]

export const SELECTION_ACTION_SEEDS: readonly BuiltinActionSeed[] = [
  {
    id: 'builtin-sel-translate',
    name: 'seed.selectionActions.translate.name',
    description: 'seed.selectionActions.translate.description',
    systemPrompt:
      'You are a professional translator. Translate the input text into the language specified in the follow-up instruction. If the input is already in that language, output it unchanged. Only output the translation, nothing else. Preserve the original formatting and tone.',
    icon: 'Languages',
    sortOrder: 0,
  },
  {
    id: 'builtin-sel-explain',
    name: 'seed.selectionActions.explain.name',
    description: 'seed.selectionActions.explain.description',
    systemPrompt:
      'You are an expert explainer. Clearly and concisely explain the meaning, concept, or context of the given text.',
    icon: 'BookOpen',
    sortOrder: 1,
  },
  {
    id: 'builtin-sel-summarize',
    name: 'seed.selectionActions.summarize.name',
    description: 'seed.selectionActions.summarize.description',
    systemPrompt:
      'You are a summarization expert. Provide a clear, concise summary that captures the key points of the input text. Use bullet points when it improves clarity.',
    icon: 'FileText',
    sortOrder: 2,
  },
  {
    id: 'builtin-sel-rewrite',
    name: 'seed.selectionActions.polish.name',
    description: 'seed.selectionActions.polish.description',
    systemPrompt:
      'You are a professional editor. Rewrite the given text to be clearer, more fluent, and more polished while preserving its original meaning and tone. Only output the rewritten text.',
    icon: 'Wand2',
    sortOrder: 3,
  },
  {
    id: 'builtin-sel-search',
    name: 'seed.selectionActions.search.name',
    description: 'seed.selectionActions.search.description',
    systemPrompt: '',
    icon: 'Search',
    sortOrder: 4,
  },
]
