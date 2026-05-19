import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import type { ApiSettings, Provider } from '@shared/types'
import { AppError } from './errors'
import { ERROR_CODES } from '@shared/errors'
import { getSetting } from './db/settings'
import { getProvider } from './db/providers'
import { getDb } from './db/database'
import { streamChat } from './ai'

interface UtilityCompletionArgs {
  messages: ChatCompletionMessageParam[]
  signal: AbortSignal
  /** Defaults to 15s. */
  timeoutMs?: number
  /** Generation knobs forwarded to the underlying provider. */
  temperature?: number
  maxCompletionTokens?: number
}

interface ResolvedUtilitySettings {
  settings: ApiSettings
}

function loadUtilitySettings(): ResolvedUtilitySettings | null {
  const providerId = getSetting('utilityModel.providerId')
  const modelId = getSetting('utilityModel.modelId')
  if (!providerId || !modelId) return null

  const provider = getProvider(providerId)
  if (!provider || !provider.apiKey) return null

  // modelId here is the row id in the models table. Look up the actual model name.
  const row = getDb().prepare('SELECT name FROM models WHERE id = ?').get(modelId) as
    | { name: string }
    | undefined
  if (!row) return null

  const settings: ApiSettings = {
    provider: provider.type,
    apiKey: provider.apiKey,
    baseUrl: provider.baseUrl,
    model: row.name,
    systemPrompt: '',
  }
  return { settings }
}

/**
 * Run a short non-streaming LLM call using the configured utility model.
 * Throws `UTILITY_MODEL_NOT_CONFIGURED` when the setting is missing — the
 * caller decides whether to fall back to its own provider/model.
 */
export async function runUtilityCompletion(args: UtilityCompletionArgs): Promise<string> {
  const resolved = loadUtilitySettings()
  if (!resolved) throw new AppError(ERROR_CODES.UTILITY_MODEL_NOT_CONFIGURED)
  return runWithSettings({ ...resolved, ...args })
}

/**
 * Same shape as runUtilityCompletion but lets the caller pass settings
 * explicitly. Used by generateTitle's fallback path.
 */
export async function runCompletionWithSettings(
  settings: ApiSettings,
  args: UtilityCompletionArgs,
): Promise<string> {
  return runWithSettings({ settings, ...args })
}

async function runWithSettings(
  opts: { settings: ApiSettings } & UtilityCompletionArgs,
): Promise<string> {
  const { settings, messages, signal, timeoutMs = 15_000, temperature, maxCompletionTokens } = opts
  const combinedSignal = AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
  const finalSettings: ApiSettings = {
    ...settings,
    temperature: temperature ?? 0.5,
    maxCompletionTokens: maxCompletionTokens ?? 256,
  }
  let buffer = ''
  await streamChat(
    {
      settings: finalSettings,
      messages,
      signal: combinedSignal,
    },
    {
      onChunk: (delta, isReasoning) => {
        if (!isReasoning) buffer += delta
      },
    },
  )
  return buffer
}

// Helper so consumers can probe whether the utility model is configured
// without paying for a network round-trip. Used by query-rewriter to skip
// rewriting entirely.
export function isUtilityModelConfigured(): boolean {
  return loadUtilitySettings() !== null
}

// Re-export Provider in case future callers want it nearby. Not strictly needed.
export type { Provider }
