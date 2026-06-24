/**
 * OpenRouter 公共 API 客户端(主进程内使用 Node 18+ 内置 fetch)。
 *
 * 两个端点都无需 API key,公开可读。15 秒超时(`AbortSignal.timeout`),
 * 支持外部 AbortSignal 复合中止。
 */

const BASE = 'https://openrouter.ai/api/v1'
const TIMEOUT_MS = 15_000

export interface OpenRouterProvider {
  name: string
  slug: string
  privacy_policy_url: string | null
  terms_of_service_url: string | null
  status_page_url: string | null
  headquarters: string | null
  datacenters: string[] | null
}

export interface OpenRouterArchitecture {
  modality: string
  input_modalities: string[]
  output_modalities: string[]
  tokenizer: string
  instruct_type: string | null
}

export interface OpenRouterReasoning {
  mandatory?: boolean
  default_enabled?: boolean
  supported_efforts?: string[]
  default_effort?: string
}

export interface OpenRouterPricing {
  prompt: string
  completion: string
  web_search?: string
  // 其他字段视情况存在,我们只用 prompt
}

export interface OpenRouterModel {
  id: string
  canonical_slug: string
  name: string
  context_length: number
  architecture: OpenRouterArchitecture
  pricing: OpenRouterPricing
  supported_parameters: string[]
  reasoning?: OpenRouterReasoning
}

function combineSignals(external?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  if (!external) return timeout
  // 任一触发即整体取消
  return AbortSignal.any([timeout, external])
}

export async function fetchProviders(signal?: AbortSignal): Promise<OpenRouterProvider[]> {
  const res = await fetch(`${BASE}/providers`, {
    headers: { Accept: 'application/json' },
    signal: combineSignals(signal),
  })
  if (!res.ok) {
    throw new OpenRouterHttpError(res.status)
  }
  const body = (await res.json()) as { data: OpenRouterProvider[] }
  return body.data ?? []
}

export async function fetchModels(signal?: AbortSignal): Promise<OpenRouterModel[]> {
  const res = await fetch(`${BASE}/models`, {
    headers: { Accept: 'application/json' },
    signal: combineSignals(signal),
  })
  if (!res.ok) {
    throw new OpenRouterHttpError(res.status)
  }
  const body = (await res.json()) as { data: OpenRouterModel[] }
  return body.data ?? []
}

export class OpenRouterHttpError extends Error {
  constructor(public readonly status: number) {
    super(`OpenRouter HTTP ${status}`)
    this.name = 'OpenRouterHttpError'
  }
}
