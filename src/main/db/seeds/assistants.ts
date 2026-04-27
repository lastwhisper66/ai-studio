export interface DefaultAssistantSeed {
  id: string
  name: string
  description: string
  isDefault: boolean
  sortOrder: number
}

export const DEFAULT_ASSISTANT_SEED: DefaultAssistantSeed = {
  id: 'default-assistant',
  name: 'seed.assistants.default.name',
  description: 'seed.assistants.default.description',
  isDefault: true,
  sortOrder: -1,
}
