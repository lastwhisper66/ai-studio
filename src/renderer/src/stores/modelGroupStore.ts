import { create } from 'zustand'
import type { ModelDefinition, ModelGroup } from '@shared/types'
import { inferModelGroup } from '@renderer/lib/inferModelGroup'

interface ModelGroupStore {
  groups: ModelGroup[]
  load: () => Promise<void>
  add: (data: { pattern: string; displayName: string; sortOrder?: number }) => Promise<void>
  update: (
    id: string,
    data: { pattern?: string; displayName?: string; sortOrder?: number },
  ) => Promise<void>
  remove: (id: string) => Promise<void>
  /**
   * Persist a new ordering. `orderedIds` must contain every existing group id
   * exactly once. Updates each row's `sort_order` and replaces the local
   * cached array in one shot. Failure rolls back the local cache.
   */
  reorder: (orderedIds: string[]) => Promise<void>
  /**
   * Resolve a display group name for a model ID.
   * Two-level matching: exact → longest prefix.
   * Falls back to `inferModelGroup()` when no rule matches (returns a string).
   */
  resolve: (modelId: string) => string
  /**
   * Same matching rules as `resolve`, but returns the full ModelGroup object
   * (or undefined when no rule matches). Does NOT fall back to
   * `inferModelGroup`. Used by the MatchPreviewBar's "matched rule" row.
   */
  resolveRule: (modelId: string) => ModelGroup | undefined
  /**
   * Resolve the display group name a `ModelDefinition` row belongs to. Used
   * by the Model Library UI (left-pane group list + right-pane filter).
   *
   * Groups are now driven by `def.group` exclusively. Pattern-prefix matching
   * (the historic behaviour) is intentionally not applied: groups follow what
   * OpenRouter declares, and users opt-in to custom groups by editing
   * `def.group` directly. Returns `undefined` when the def has no group set
   * — caller renders these as "unmatched".
   */
  resolveDefinitionGroup: (def: ModelDefinition) => string | undefined
}

function matchRule(groups: ModelGroup[], modelId: string): ModelGroup | undefined {
  const lower = modelId.toLowerCase()

  const exact = groups.find((g) => g.pattern.toLowerCase() === lower)
  if (exact) return exact

  let best: ModelGroup | undefined
  for (const g of groups) {
    if (lower.startsWith(g.pattern.toLowerCase())) {
      if (!best || g.pattern.length > best.pattern.length) best = g
    }
  }
  return best
}

export const useModelGroupStore = create<ModelGroupStore>((set, get) => ({
  groups: [],

  load: async () => {
    const result = await window.api.listModelGroups()
    if (result.success && result.data) {
      set({ groups: result.data })
    }
  },

  add: async (data) => {
    const result = await window.api.createModelGroup(data)
    if (result.success && result.data) {
      set((s) => ({ groups: [...s.groups, result.data!] }))
    }
  },

  update: async (id, data) => {
    const result = await window.api.updateModelGroup(id, data)
    if (result.success && result.data) {
      set((s) => ({
        groups: s.groups.map((g) => (g.id === id ? result.data! : g)),
      }))
    }
  },

  remove: async (id) => {
    const result = await window.api.deleteModelGroup(id)
    if (result.success) {
      set((s) => ({ groups: s.groups.filter((g) => g.id !== id) }))
    }
  },

  reorder: async (orderedIds) => {
    const previous = get().groups
    const byId = new Map(previous.map((g) => [g.id, g]))
    const reordered = orderedIds
      .map((id, idx) => {
        const g = byId.get(id)
        return g ? { ...g, sortOrder: idx } : undefined
      })
      .filter((g): g is ModelGroup => g !== undefined)
    set({ groups: reordered })
    try {
      await Promise.all(
        orderedIds.map((id, idx) => window.api.updateModelGroup(id, { sortOrder: idx })),
      )
    } catch (err) {
      set({ groups: previous })
      throw err
    }
  },

  resolve: (modelId: string): string => {
    const hit = matchRule(get().groups, modelId)
    return hit ? hit.displayName : inferModelGroup(modelId)
  },

  resolveRule: (modelId: string): ModelGroup | undefined => {
    return matchRule(get().groups, modelId)
  },

  resolveDefinitionGroup: (def: ModelDefinition): string | undefined => {
    if (!def.group) return undefined
    const trimmed = def.group.trim()
    return trimmed.length > 0 ? trimmed : undefined
  },
}))
