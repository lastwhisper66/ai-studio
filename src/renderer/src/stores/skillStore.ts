import { create } from 'zustand'
import type { Skill, CreateSkillPayload, UpdateSkillPayload } from '@shared/types'

interface SkillStore {
  skills: Skill[]
  isLoaded: boolean
  selectedSkillId: string | null

  loadSkills: () => Promise<void>
  addSkill: (data: CreateSkillPayload) => Promise<Skill | undefined>
  updateSkill: (id: string, data: UpdateSkillPayload) => Promise<void>
  deleteSkill: (id: string) => Promise<void>
  reorderSkills: (orderedIds: string[]) => Promise<void>
  setSelectedSkillId: (id: string | null) => void
}

export const useSkillStore = create<SkillStore>((set, get) => ({
  skills: [],
  isLoaded: false,
  selectedSkillId: null,

  loadSkills: async () => {
    const result = await window.api.listSkills()
    if (result.success && result.data) {
      set({
        skills: result.data,
        isLoaded: true,
        selectedSkillId: get().selectedSkillId ?? result.data[0]?.id ?? null,
      })
    }
  },

  addSkill: async (data) => {
    const result = await window.api.createSkill(data)
    if (result.success && result.data) {
      const skill = result.data
      set((state) => ({
        skills: [...state.skills, skill],
        selectedSkillId: skill.id,
      }))
      return skill
    }
    return undefined
  },

  updateSkill: async (id, data) => {
    const result = await window.api.updateSkill(id, data)
    if (result.success && result.data) {
      const updated = result.data
      set((state) => ({
        skills: state.skills.map((s) => (s.id === id ? updated : s)),
      }))
    }
  },

  deleteSkill: async (id) => {
    const result = await window.api.deleteSkill(id)
    if (result.success) {
      set((state) => {
        const skills = state.skills.filter((s) => s.id !== id)
        const wasSelected = state.selectedSkillId === id
        return {
          skills,
          selectedSkillId: wasSelected ? (skills[0]?.id ?? null) : state.selectedSkillId,
        }
      })
    }
  },

  reorderSkills: async (orderedIds) => {
    set((state) => {
      const idToIndex = new Map(orderedIds.map((id, i) => [id, i]))
      return {
        skills: [...state.skills].sort(
          (a, b) => (idToIndex.get(a.id) ?? Infinity) - (idToIndex.get(b.id) ?? Infinity),
        ),
      }
    })
    const result = await window.api.reorderSkills(orderedIds)
    if (!result.success) {
      await get().loadSkills()
    }
  },

  setSelectedSkillId: (id) => set({ selectedSkillId: id }),
}))
