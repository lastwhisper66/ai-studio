import type { ModelCapability, ProviderType } from '@shared/types'
import modelDefinitionData from './seed-model-definitions.json'
import modelGroupData from './seed-model-groups.json'

export const MODEL_DEFINITIONS_SEED_VERSION = 3
export const MODEL_GROUPS_SEED_VERSION = 1

export interface ModelDefinitionSeed {
  name: string
  group: string
  capabilities: ModelCapability[]
  providerTypes: ProviderType[]
}

export interface ModelGroupSeed {
  pattern: string
  displayName: string
}

export const MODEL_DEFINITION_SEEDS: ModelDefinitionSeed[] =
  modelDefinitionData as ModelDefinitionSeed[]

export const MODEL_GROUP_SEEDS: ModelGroupSeed[] = modelGroupData as ModelGroupSeed[]
