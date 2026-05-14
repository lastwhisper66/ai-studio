export { DEFAULT_ASSISTANT, type BuiltinDefaultAssistant } from './default-assistant'
export { ASSISTANT_TEMPLATES, type BuiltinAssistantTemplate } from './assistant-templates'
export { QUICK_ACTIONS, type BuiltinQuickAction } from './quick-actions'
export { SELECTION_ACTIONS, type BuiltinSelectionAction } from './selection-actions'

/**
 * Each builtin category has its own version. Bump the relevant one ONLY when
 * you intentionally change definitions in that category. On boot the renderer
 * compares each `*_VERSION` to its `builtins.<category>.appliedVersion`
 * setting; if higher, the corresponding settings section shows an
 * "updates available" banner. The user must manually apply updates — boot
 * never overwrites user edits.
 *
 * Default assistant changes infrequently and rides on the templates banner
 * (it's shown in the Assistant Library section), so it shares
 * BUILTIN_TEMPLATES_VERSION.
 */
export const BUILTIN_TEMPLATES_VERSION = 1
export const BUILTIN_QUICK_ACTIONS_VERSION = 1
export const BUILTIN_SELECTION_ACTIONS_VERSION = 1
