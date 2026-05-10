export interface AssistantTemplateSeed {
  id: string
  nameKey: string
  iconEmoji: string
  descriptionKey: string
  category: string
  systemPromptKey: string
  promptSuggestionKeys: readonly string[]
  recommendedModel: string
  temperature?: string
  maxCompletionTokens?: string
  topP?: string
  contextCount?: string
}

export const ASSISTANT_TEMPLATE_SEEDS: readonly AssistantTemplateSeed[] = [
  {
    id: 'tpl-builtin-general',
    nameKey: 'seed.templates.general.name',
    iconEmoji: '💬',
    descriptionKey: 'seed.templates.general.description',
    category: 'general',
    systemPromptKey: 'seed.templates.general.systemPrompt',
    promptSuggestionKeys: [
      'seed.templates.general.suggestions.0',
      'seed.templates.general.suggestions.1',
      'seed.templates.general.suggestions.2',
    ],
    recommendedModel: '',
  },
  {
    id: 'tpl-builtin-coding',
    nameKey: 'seed.templates.coding.name',
    iconEmoji: '💻',
    descriptionKey: 'seed.templates.coding.description',
    category: 'coding',
    systemPromptKey: 'seed.templates.coding.systemPrompt',
    promptSuggestionKeys: [
      'seed.templates.coding.suggestions.0',
      'seed.templates.coding.suggestions.1',
      'seed.templates.coding.suggestions.2',
    ],
    recommendedModel: 'claude-3-5-sonnet',
  },
  {
    id: 'tpl-builtin-translator',
    nameKey: 'seed.templates.translator.name',
    iconEmoji: '🌐',
    descriptionKey: 'seed.templates.translator.description',
    category: 'translation',
    systemPromptKey: 'seed.templates.translator.systemPrompt',
    promptSuggestionKeys: [
      'seed.templates.translator.suggestions.0',
      'seed.templates.translator.suggestions.1',
    ],
    recommendedModel: 'gpt-4o',
    temperature: '0.3',
  },
  {
    id: 'tpl-builtin-writing-editor',
    nameKey: 'seed.templates.writingEditor.name',
    iconEmoji: '✍️',
    descriptionKey: 'seed.templates.writingEditor.description',
    category: 'writing',
    systemPromptKey: 'seed.templates.writingEditor.systemPrompt',
    promptSuggestionKeys: [
      'seed.templates.writingEditor.suggestions.0',
      'seed.templates.writingEditor.suggestions.1',
      'seed.templates.writingEditor.suggestions.2',
    ],
    recommendedModel: 'claude-3-5-sonnet',
  },
  {
    id: 'tpl-builtin-summarizer',
    nameKey: 'seed.templates.summarizer.name',
    iconEmoji: '📝',
    descriptionKey: 'seed.templates.summarizer.description',
    category: 'general',
    systemPromptKey: 'seed.templates.summarizer.systemPrompt',
    promptSuggestionKeys: [
      'seed.templates.summarizer.suggestions.0',
      'seed.templates.summarizer.suggestions.1',
    ],
    recommendedModel: 'gpt-4o-mini',
  },
  {
    id: 'tpl-builtin-study-coach',
    nameKey: 'seed.templates.studyCoach.name',
    iconEmoji: '🎓',
    descriptionKey: 'seed.templates.studyCoach.description',
    category: 'learning',
    systemPromptKey: 'seed.templates.studyCoach.systemPrompt',
    promptSuggestionKeys: [
      'seed.templates.studyCoach.suggestions.0',
      'seed.templates.studyCoach.suggestions.1',
      'seed.templates.studyCoach.suggestions.2',
    ],
    recommendedModel: 'gpt-4o',
  },
  {
    id: 'tpl-builtin-pm',
    nameKey: 'seed.templates.pm.name',
    iconEmoji: '📊',
    descriptionKey: 'seed.templates.pm.description',
    category: 'business',
    systemPromptKey: 'seed.templates.pm.systemPrompt',
    promptSuggestionKeys: [
      'seed.templates.pm.suggestions.0',
      'seed.templates.pm.suggestions.1',
      'seed.templates.pm.suggestions.2',
    ],
    recommendedModel: 'gpt-4o',
  },
  {
    id: 'tpl-builtin-data-analyst',
    nameKey: 'seed.templates.dataAnalyst.name',
    iconEmoji: '📈',
    descriptionKey: 'seed.templates.dataAnalyst.description',
    category: 'business',
    systemPromptKey: 'seed.templates.dataAnalyst.systemPrompt',
    promptSuggestionKeys: [
      'seed.templates.dataAnalyst.suggestions.0',
      'seed.templates.dataAnalyst.suggestions.1',
    ],
    recommendedModel: 'gpt-4o',
  },
  {
    id: 'tpl-builtin-prompt-engineer',
    nameKey: 'seed.templates.promptEngineer.name',
    iconEmoji: '🛠️',
    descriptionKey: 'seed.templates.promptEngineer.description',
    category: 'general',
    systemPromptKey: 'seed.templates.promptEngineer.systemPrompt',
    promptSuggestionKeys: [
      'seed.templates.promptEngineer.suggestions.0',
      'seed.templates.promptEngineer.suggestions.1',
    ],
    recommendedModel: 'claude-3-5-sonnet',
  },
  {
    id: 'tpl-builtin-creative-writer',
    nameKey: 'seed.templates.creativeWriter.name',
    iconEmoji: '🎨',
    descriptionKey: 'seed.templates.creativeWriter.description',
    category: 'creative',
    systemPromptKey: 'seed.templates.creativeWriter.systemPrompt',
    promptSuggestionKeys: [
      'seed.templates.creativeWriter.suggestions.0',
      'seed.templates.creativeWriter.suggestions.1',
      'seed.templates.creativeWriter.suggestions.2',
    ],
    recommendedModel: 'claude-3-5-sonnet',
    temperature: '0.9',
  },
]
