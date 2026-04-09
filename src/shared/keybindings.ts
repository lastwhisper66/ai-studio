// ── Keyboard shortcut registry & matching utilities ────────────────

export type KeybindingActionId =
  | 'new-conversation'
  | 'toggle-settings'
  | 'toggle-sidebar'
  | 'toggle-topic'
  | 'stop-generation'
  | 'summon-window'

export interface KeybindingDef {
  defaultAccelerator: string
  labelKey: string
  category: 'app' | 'chat' | 'window'
  readOnly?: boolean
}

export const DEFAULT_KEYBINDINGS: Record<KeybindingActionId, KeybindingDef> = {
  'new-conversation': {
    defaultAccelerator: 'Ctrl+N',
    labelKey: 'keybindings.newConversation',
    category: 'chat',
  },
  'toggle-settings': {
    defaultAccelerator: 'Ctrl+,',
    labelKey: 'keybindings.toggleSettings',
    category: 'app',
  },
  'toggle-sidebar': {
    defaultAccelerator: 'Ctrl+B',
    labelKey: 'keybindings.toggleSidebar',
    category: 'window',
  },
  'toggle-topic': {
    defaultAccelerator: 'Ctrl+Shift+B',
    labelKey: 'keybindings.toggleTopic',
    category: 'window',
  },
  'stop-generation': {
    defaultAccelerator: 'Escape',
    labelKey: 'keybindings.stopGeneration',
    category: 'chat',
  },
  'summon-window': {
    defaultAccelerator: 'Ctrl+Super+A',
    labelKey: 'keybindings.summonWindow',
    category: 'app',
    readOnly: true,
  },
}

// ── Accelerator parsing & matching ─────────────────────────────────

export interface ParsedShortcut {
  ctrl: boolean
  shift: boolean
  alt: boolean
  meta: boolean
  key: string
}

export function parseAccelerator(accelerator: string): ParsedShortcut {
  const parts = accelerator.split('+')
  const key = parts[parts.length - 1].toLowerCase()
  return {
    ctrl: parts.includes('Ctrl'),
    shift: parts.includes('Shift'),
    alt: parts.includes('Alt'),
    meta: parts.includes('Super') || parts.includes('Meta'),
    key,
  }
}

/** Match a DOM KeyboardEvent against an accelerator string */
export function matchesShortcut(e: KeyboardEvent, accelerator: string | null): boolean {
  if (!accelerator) return false
  const p = parseAccelerator(accelerator)
  return (
    e.ctrlKey === p.ctrl &&
    e.shiftKey === p.shift &&
    e.altKey === p.alt &&
    e.metaKey === p.meta &&
    e.key.toLowerCase() === p.key
  )
}

/** Build an accelerator string from a DOM KeyboardEvent */
export function acceleratorFromEvent(e: KeyboardEvent): string {
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return ''
  const parts: string[] = []
  if (e.ctrlKey) parts.push('Ctrl')
  if (e.shiftKey) parts.push('Shift')
  if (e.altKey) parts.push('Alt')
  if (e.metaKey) parts.push('Super')
  parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key)
  return parts.join('+')
}

/** Display-friendly label for an accelerator key part */
export function formatKeyLabel(part: string): string {
  const map: Record<string, string> = {
    Ctrl: 'Ctrl',
    Shift: 'Shift',
    Alt: 'Alt',
    Super: 'Win',
    Meta: 'Win',
    Escape: 'Esc',
    ' ': 'Space',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
  }
  return map[part] ?? part
}
