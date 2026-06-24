import type { OpenRouterModel, OpenRouterProvider } from './openrouter-client'
import type { ModelCapability } from '@shared/types'

export interface DefinitionRow {
  name: string
  group: string
  capabilities: ModelCapability[]
  contextWindow: number | null
  reasoningEfforts: string[] | null
}

export interface MapResult {
  definitions: DefinitionRow[]
  skippedCount: number
}

/**
 * 判定一条 OpenRouter 模型是否应该被跳过。
 * 跳过的都是 OpenRouter 自家的 routing / preset variant,直连 provider 拿不到。
 */
export function shouldSkipModel(model: OpenRouterModel): boolean {
  const id = model.id
  if (!id || !id.includes('/')) return true

  // 1) 带 ":xxx" 后缀(`:free`、`:thinking`、`:nitro` 等)
  if (id.includes(':')) return true

  // 2) "~" 前缀的 redirect alias
  if (id.startsWith('~')) return true

  // 3) "openrouter/" slug
  const slug = id.split('/')[0]
  if (slug === 'openrouter') return true

  // 4) tokenizer = "Router"(switchpoint/router 等通用 router)
  if (model.architecture?.tokenizer === 'Router') return true

  // 5) pricing.prompt === "-1"(OpenRouter routing 的特殊价格)
  if (model.pricing?.prompt === '-1') return true

  return false
}

/**
 * 从 OpenRouter id 抽取本地 model_definitions.name。
 * 取最后一个 "/" 之后的部分。
 *
 * 例:
 *   "openai/gpt-5"              → "gpt-5"
 *   "anthropic/claude-sonnet-4" → "claude-sonnet-4"
 */
export function extractName(id: string): string {
  const idx = id.lastIndexOf('/')
  return idx < 0 ? id : id.slice(idx + 1)
}

/**
 * 从 OpenRouter id 第一段 slug 查 providers 显示名。
 * 找不到则 fallback 用 slug 首字母大写。
 *
 * 例:
 *   id="openai/gpt-5", map有 openai → "OpenAI" → "OpenAI"
 *   id="newvendor/foo", map 无 → "Newvendor"
 */
export function extractGroup(id: string, slugToName: Map<string, string>): string {
  let slug = id.split('/')[0]
  if (slug.startsWith('~')) slug = slug.slice(1)
  const display = slugToName.get(slug)
  if (display) return display
  return slug.charAt(0).toUpperCase() + slug.slice(1)
}

/** 从 OpenRouter 字段推导本地 `ModelCapability` 数组。 */
export function deriveCapabilities(model: OpenRouterModel): ModelCapability[] {
  const result: ModelCapability[] = []
  const params = model.supported_parameters ?? []
  const inputMods = model.architecture?.input_modalities ?? []

  // reasoning: 顶层 reasoning 对象存在,或参数支持 reasoning/include_reasoning
  if (
    model.reasoning !== undefined ||
    params.includes('reasoning') ||
    params.includes('include_reasoning')
  ) {
    result.push('reasoning')
  }
  // vision: input_modalities 含 image 或 video
  if (inputMods.includes('image') || inputMods.includes('video')) {
    result.push('vision')
  }
  // tools: supported_parameters 含 tools
  if (params.includes('tools')) {
    result.push('tools')
  }
  // 注意:本应用不再使用 'web' 维度。OpenRouter `pricing.web_search` 是代理服务定价,
  // 不代表模型本身能力,故不映射。
  return result
}

/** 提取 reasoning_efforts;模型无 reasoning 字段时返回 null。 */
export function extractReasoningEfforts(model: OpenRouterModel): string[] | null {
  const efforts = model.reasoning?.supported_efforts
  if (!Array.isArray(efforts) || efforts.length === 0) return null
  return efforts.slice()
}

/** Main mapping entry. Generates `model_definitions` rows only.
 *
 * `model_groups` is intentionally NOT populated by sync: it's reserved for
 * user-defined groups now. UI groups definitions by `def.group` field
 * (= provider display name written here) directly.
 */
export function mapOpenRouter(
  providers: OpenRouterProvider[],
  models: OpenRouterModel[],
): MapResult {
  const slugToName = new Map<string, string>()
  for (const p of providers) {
    slugToName.set(p.slug, p.name)
  }

  const definitions: DefinitionRow[] = []
  let skippedCount = 0
  for (const model of models) {
    if (shouldSkipModel(model)) {
      skippedCount++
      continue
    }
    definitions.push({
      name: extractName(model.id),
      group: extractGroup(model.id, slugToName),
      capabilities: deriveCapabilities(model),
      contextWindow: model.context_length ?? null,
      reasoningEfforts: extractReasoningEfforts(model),
    })
  }

  return { definitions, skippedCount }
}
