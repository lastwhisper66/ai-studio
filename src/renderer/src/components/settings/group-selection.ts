import type { ModelGroup } from '@shared/types'

export type GroupSelection =
  | { kind: 'all' }
  | { kind: 'unmatched' }
  | { kind: 'rule'; group: ModelGroup }

export const SEL_ALL: GroupSelection = { kind: 'all' }
export const SEL_UNMATCHED: GroupSelection = { kind: 'unmatched' }

export function isSameSelection(a: GroupSelection, b: GroupSelection): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'rule' && b.kind === 'rule') return a.group.id === b.group.id
  return true
}
