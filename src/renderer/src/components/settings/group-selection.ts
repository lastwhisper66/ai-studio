export type GroupSelection =
  | { kind: 'all' }
  | { kind: 'unmatched' }
  | { kind: 'group'; displayName: string }

export const SEL_ALL: GroupSelection = { kind: 'all' }
export const SEL_UNMATCHED: GroupSelection = { kind: 'unmatched' }

export function isSameSelection(a: GroupSelection, b: GroupSelection): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'group' && b.kind === 'group') return a.displayName === b.displayName
  return true
}
