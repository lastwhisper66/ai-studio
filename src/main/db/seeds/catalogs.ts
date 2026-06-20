import type { ModelCapability } from '@shared/types'
import modelDefinitionData from './seed-model-definitions.json'
import modelGroupData from './seed-model-groups.json'

export const MODEL_DEFINITIONS_SEED_VERSION = 4
export const MODEL_GROUPS_SEED_VERSION = 2

export interface ModelDefinitionSeed {
  name: string
  group: string
  capabilities: ModelCapability[]
  contextWindow?: number
}

export interface ModelGroupSeed {
  pattern: string
  displayName: string
}

export const MODEL_DEFINITION_SEEDS: ModelDefinitionSeed[] =
  modelDefinitionData as ModelDefinitionSeed[]

export const MODEL_GROUP_SEEDS: ModelGroupSeed[] = modelGroupData as ModelGroupSeed[]
