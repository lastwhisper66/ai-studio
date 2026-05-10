import { create } from 'zustand'
import type { Assistant, ImportPlan, ImportResolution, ImportResult } from '@shared/types'

interface AssistantTemplateStore {
  templates: Assistant[]
  isLoaded: boolean

  loadTemplates: () => Promise<void>
  createTemplate: (data: Partial<Assistant> & { name: string }) => Promise<Assistant | undefined>
  updateTemplate: (id: string, data: Partial<Assistant>) => Promise<void>
  deleteTemplate: (id: string) => Promise<void>
  reorderTemplates: (orderedIds: string[]) => Promise<void>

  addFromTemplate: (templateId: string) => Promise<Assistant | undefined>
  saveAsTemplate: (assistantId: string) => Promise<Assistant | undefined>

  exportTemplate: (templateId: string) => Promise<{ filePath: string } | null | undefined>
  importTemplates: () => Promise<ImportPlan | null | undefined>
  applyImport: (payload: {
    ok: Assistant[]
    resolutions: Array<ImportResolution & { template?: Assistant }>
  }) => Promise<ImportResult | undefined>

  resetBuiltins: (mode: 'overwrite' | 'restore-deleted') => Promise<boolean>
}

export const useAssistantTemplateStore = create<AssistantTemplateStore>((set, get) => ({
  templates: [],
  isLoaded: false,

  loadTemplates: async () => {
    const r = await window.api.assistantTemplate.list()
    if (r.success && r.data) set({ templates: r.data, isLoaded: true })
  },

  createTemplate: async (data) => {
    const r = await window.api.assistantTemplate.create(data)
    if (r.success && r.data) {
      set((s) => ({ templates: [...s.templates, r.data!] }))
      return r.data
    }
    return undefined
  },

  updateTemplate: async (id, data) => {
    const r = await window.api.assistantTemplate.update(id, data)
    if (r.success && r.data) {
      const updated = r.data
      set((s) => ({ templates: s.templates.map((t) => (t.id === id ? updated : t)) }))
    }
  },

  deleteTemplate: async (id) => {
    const r = await window.api.assistantTemplate.delete(id)
    if (r.success) {
      set((s) => ({ templates: s.templates.filter((t) => t.id !== id) }))
    }
  },

  reorderTemplates: async (orderedIds) => {
    set((s) => {
      const idx = new Map(orderedIds.map((id, i) => [id, i]))
      return {
        templates: [...s.templates].sort(
          (a, b) => (idx.get(a.id) ?? Infinity) - (idx.get(b.id) ?? Infinity),
        ),
      }
    })
    const r = await window.api.assistantTemplate.reorder(orderedIds)
    if (!r.success) await get().loadTemplates()
  },

  addFromTemplate: async (templateId) => {
    const r = await window.api.assistantTemplate.addFromTemplate(templateId)
    return r.success ? r.data : undefined
  },

  saveAsTemplate: async (assistantId) => {
    const r = await window.api.assistantTemplate.saveAsTemplate(assistantId)
    if (r.success && r.data) {
      set((s) => ({ templates: [...s.templates, r.data!] }))
      return r.data
    }
    return undefined
  },

  exportTemplate: async (templateId) => {
    const r = await window.api.assistantTemplate.exportPack([templateId])
    return r.success ? r.data : undefined
  },

  importTemplates: async () => {
    const r = await window.api.assistantTemplate.importPack()
    return r.success ? r.data : undefined
  },

  applyImport: async (payload) => {
    const r = await window.api.assistantTemplate.applyImport(payload)
    if (r.success) await get().loadTemplates()
    return r.success ? r.data : undefined
  },

  resetBuiltins: async (mode) => {
    const r = await window.api.assistantTemplate.resetBuiltins(mode)
    if (r.success) await get().loadTemplates()
    return r.success
  },
}))
