import type { Assistant } from '@shared/types'

export const BUILTIN_CATEGORIES = [
  'general',
  'writing',
  'coding',
  'translation',
  'learning',
  'creative',
  'business',
  'life',
] as const

export type BuiltinCategory = (typeof BUILTIN_CATEGORIES)[number]

/** Returns deduped category list: BUILTIN ∪ existing custom values, in display order. */
export function listAllCategories(templates: Assistant[]): string[] {
  const builtins = new Set<string>(BUILTIN_CATEGORIES)
  const custom = new Set<string>()
  for (const t of templates) {
    if (t.category && !builtins.has(t.category)) custom.add(t.category)
  }
  return [...BUILTIN_CATEGORIES, ...Array.from(custom).sort()]
}

/** Categories of `kind='assistant'` rows = distinct `group` values. */
export function listAssistantGroups(assistants: Assistant[]): string[] {
  const set = new Set<string>()
  for (const a of assistants) if (a.group) set.add(a.group)
  return Array.from(set).sort()
}
