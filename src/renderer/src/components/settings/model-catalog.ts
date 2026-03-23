import type { ProviderType, ModelCapability } from '@shared/types'

/** A model entry in the static catalog */
export interface CatalogModel {
  /** Model ID sent to the API (e.g. "gpt-4o") */
  id: string
  /** Display group for collapsing (e.g. "GPT-4o") */
  group: string
  /** Capability tags */
  capabilities: ModelCapability[]
}

// ---------------------------------------------------------------------------
// OpenAI
// ---------------------------------------------------------------------------
const OPENAI_MODELS: CatalogModel[] = [
  // GPT-5
  { id: 'gpt-5.4', group: 'GPT-5', capabilities: ['reasoning', 'vision', 'web', 'tools'] },
  { id: 'gpt-5.3-codex', group: 'GPT-5', capabilities: ['reasoning', 'vision', 'web', 'tools'] },
]

// ---------------------------------------------------------------------------
// DeepSeek
// ---------------------------------------------------------------------------
const DEEPSEEK_MODELS: CatalogModel[] = [
  { id: 'deepseek-chat', group: 'DeepSeek-V3', capabilities: ['tools'] },
  { id: 'deepseek-reasoner', group: 'DeepSeek-R1', capabilities: ['reasoning'] },
]

// ---------------------------------------------------------------------------
// Silicon Flow (硅基流动)
// ---------------------------------------------------------------------------
const SILICON_MODELS: CatalogModel[] = [
  // DeepSeek on Silicon
  {
    id: 'deepseek-ai/DeepSeek-V3',
    group: 'DeepSeek',
    capabilities: ['tools'],
  },
  {
    id: 'deepseek-ai/DeepSeek-R1',
    group: 'DeepSeek',
    capabilities: ['reasoning'],
  },
  {
    id: 'Pro/deepseek-ai/DeepSeek-V3',
    group: 'DeepSeek (Pro)',
    capabilities: ['tools'],
  },
  {
    id: 'Pro/deepseek-ai/DeepSeek-R1',
    group: 'DeepSeek (Pro)',
    capabilities: ['reasoning'],
  },
  // Qwen
  {
    id: 'Qwen/Qwen3-235B-A22B',
    group: 'Qwen',
    capabilities: ['reasoning', 'tools'],
  },
  {
    id: 'Qwen/Qwen2.5-72B-Instruct',
    group: 'Qwen',
    capabilities: ['tools'],
  },
  {
    id: 'Qwen/Qwen2.5-Coder-32B-Instruct',
    group: 'Qwen',
    capabilities: ['tools'],
  },
  {
    id: 'Pro/Qwen/Qwen2.5-72B-Instruct',
    group: 'Qwen (Pro)',
    capabilities: ['tools'],
  },
  // GLM
  { id: 'THUDM/GLM-4-9B-0414', group: 'GLM', capabilities: ['tools'] },
  {
    id: 'Pro/THUDM/GLM-Z1-32B-0414',
    group: 'GLM (Pro)',
    capabilities: ['reasoning', 'tools'],
  },
  // Embedding
  {
    id: 'BAAI/bge-m3',
    group: 'Embedding',
    capabilities: ['embedding'],
  },
  {
    id: 'BAAI/bge-reranker-v2-m3',
    group: 'Reranking',
    capabilities: ['reranking'],
  },
]

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------
const CATALOG_MAP: Partial<Record<ProviderType, CatalogModel[]>> = {
  openai: OPENAI_MODELS,
  deepseek: DEEPSEEK_MODELS,
  silicon: SILICON_MODELS,
}

/** Get the static model catalog for a given provider type. Returns [] for unknown types. */
export function getModelCatalog(type: ProviderType): CatalogModel[] {
  return CATALOG_MAP[type] ?? []
}
