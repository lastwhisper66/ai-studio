/**
 * Noise suffixes stripped from the right side of a model ID when inferring
 * the series/family group name for unmatched models.
 */
const NOISE_PATTERNS: RegExp[] = [
  /^\d{4}-\d{2}-\d{2}$/, // date: 2025-04-14
  /^\d{8}$/, // compact date: 20250414
  /^\d+(\.\d+)?[bBkKmM]$/, // param count: 72b, 1.5B
  /^(instruct|chat|it|hf|gguf|latest|preview|exp|turbo|fast|lite|nano|mini|micro|plus|pro|max|ultra|standard|base|raw)$/i,
  /^v\d+$/i, // version tag: v2, v3
]

/** Known brand overrides for title-casing. */
const BRAND_CASE: Record<string, string> = {
  gpt: 'GPT',
  dall: 'DALL',
  e: 'E',
  o1: 'O1',
  o3: 'O3',
  o4: 'O4',
  glm: 'GLM',
  llm: 'LLM',
  ai: 'AI',
}

function titleCaseSegment(seg: string): string {
  const lower = seg.toLowerCase()
  if (BRAND_CASE[lower]) return BRAND_CASE[lower]
  if (/^[A-Z]{3,}$/.test(seg)) return seg
  return seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase()
}

function isNoise(segment: string): boolean {
  return NOISE_PATTERNS.some((re) => re.test(segment))
}

function isVersionNumber(segment: string): boolean {
  return /^\d+(\.\d+)*$/.test(segment)
}

/**
 * Infer a human-friendly series/family group name from a raw model ID.
 *
 * Examples:
 *   gpt-5.1-mini-2025-04-14   → GPT-5.1
 *   qwen-2.5-72b-instruct     → Qwen-2.5
 *   llama-3.1-8b-instruct     → Llama-3.1
 *   deepseek-ai/DeepSeek-V3.2 → DeepSeek-AI/DeepSeek
 *   text-embedding-3-large    → Text-Embedding-3
 *   o1-mini                   → O1
 */
export function inferModelGroup(modelId: string): string {
  if (!modelId || !modelId.trim()) return 'Unknown'

  // Handle path-style IDs (e.g. "deepseek-ai/DeepSeek-V3.2")
  const slashParts = modelId.split('/')
  const lastPart = slashParts[slashParts.length - 1]
  const prefixParts = slashParts.slice(0, -1)

  // Split on '-' and strip noise from the right
  const segments = lastPart.split('-')
  let end = segments.length

  while (end > 1) {
    const tail = segments[end - 1]
    if (isVersionNumber(tail)) break
    if (isNoise(tail)) {
      end--
    } else {
      break
    }
  }

  // If the last kept segment is a standalone version number and it's the only thing left
  // after a brand name, keep it (e.g. "qwen-2.5" → keep both)
  const keptSegments = end > 0 ? segments.slice(0, end) : [segments[0]]

  // Title-case each segment
  const casedLast = keptSegments.map(titleCaseSegment).join('-')

  if (prefixParts.length > 0) {
    const casedPrefixes = prefixParts.map((part) => part.split('-').map(titleCaseSegment).join('-'))
    return [...casedPrefixes, casedLast].join('/')
  }

  return casedLast
}
