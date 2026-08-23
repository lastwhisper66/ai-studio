import type { BrandIcon } from '@renderer/components/settings/provider-icons'

// Deep-path imports — see the comment in provider-icons.tsx for why the barrel
// and `es/<Name>` entry points are both avoided.
import OpenAI from '@lobehub/icons/es/OpenAI/components/Mono'
import Claude from '@lobehub/icons/es/Claude/components/Color'
import Gemini from '@lobehub/icons/es/Gemini/components/Color'
import Gemma from '@lobehub/icons/es/Gemma/components/Color'
import DeepSeek from '@lobehub/icons/es/DeepSeek/components/Color'
import Qwen from '@lobehub/icons/es/Qwen/components/Color'
// Kimi uses Mono: its Color variant is a white glyph meant for a dark tile, so
// it renders invisible on a light background.
import Kimi from '@lobehub/icons/es/Kimi/components/Mono'
import Moonshot from '@lobehub/icons/es/Moonshot/components/Mono'
// Directory is `Zhipu`, not `ZhiPu` — the deep path is case-sensitive on Linux
// (CI) even though Windows/macOS resolve either spelling.
import ZhiPu from '@lobehub/icons/es/Zhipu/components/Color'
import Grok from '@lobehub/icons/es/Grok/components/Mono'
import Mistral from '@lobehub/icons/es/Mistral/components/Color'
import Cohere from '@lobehub/icons/es/Cohere/components/Color'
import Meta from '@lobehub/icons/es/Meta/components/Color'
import Microsoft from '@lobehub/icons/es/Microsoft/components/Color'
import Doubao from '@lobehub/icons/es/Doubao/components/Color'
import Hunyuan from '@lobehub/icons/es/Hunyuan/components/Color'
import Minimax from '@lobehub/icons/es/Minimax/components/Color'
import Stepfun from '@lobehub/icons/es/Stepfun/components/Mono'
import Baichuan from '@lobehub/icons/es/Baichuan/components/Color'
import InternLM from '@lobehub/icons/es/InternLM/components/Color'
import Yi from '@lobehub/icons/es/Yi/components/Color'
import Wenxin from '@lobehub/icons/es/Wenxin/components/Color'
import SenseNova from '@lobehub/icons/es/SenseNova/components/Color'
import Spark from '@lobehub/icons/es/Spark/components/Color'
import Nvidia from '@lobehub/icons/es/Nvidia/components/Color'
import Perplexity from '@lobehub/icons/es/Perplexity/components/Color'

/**
 * Ordered model-name → brand rules. First match wins, so keep specific
 * patterns above looser ones.
 *
 * Short tokens (`yi`, `phi`, `step`, `o1`) are separator-anchored on purpose:
 * a bare /yi/ would also match "qwen-vl" style IDs by accident.
 */
const RULES: [RegExp, BrandIcon][] = [
  [/(gpt|chatgpt|davinci|dall[-_]?e|whisper|text[-_]embedding|codex|sora)/i, OpenAI],
  [/(^|[/\-_])o[1-4]([-_]|$)/i, OpenAI],
  [/claude/i, Claude],
  [/gemini/i, Gemini],
  [/gemma/i, Gemma],
  [/deepseek/i, DeepSeek],
  [/(qwen|qwq|qvq|tongyi)/i, Qwen],
  [/kimi/i, Kimi],
  [/moonshot/i, Moonshot],
  [/(glm|chatglm|cogview|cogvideo)/i, ZhiPu],
  [/grok/i, Grok],
  [/(mistral|mixtral|codestral|magistral|devstral|pixtral|ministral)/i, Mistral],
  [/(^|[/\-_])command([-_]|$)/i, Cohere],
  [/(^|[/\-_])aya([-_]|$)/i, Cohere],
  [/(llama|codellama)/i, Meta],
  [/(^|[/\-_])phi[-_]?\d/i, Microsoft],
  [/doubao/i, Doubao],
  [/hunyuan/i, Hunyuan],
  [/(minimax|abab)/i, Minimax],
  [/(^|[/\-_])step[-_]?\d/i, Stepfun],
  [/baichuan/i, Baichuan],
  [/(internlm|internvl)/i, InternLM],
  [/(^|[/\-_])yi[-_]/i, Yi],
  [/(ernie|wenxin)/i, Wenxin],
  [/sense(chat|nova)/i, SenseNova],
  [/spark(desk)?/i, Spark],
  [/nemotron/i, Nvidia],
  [/sonar/i, Perplexity],
]

/**
 * Infer a brand icon from a raw model ID, so a model row shows the vendor that
 * actually made it rather than the provider serving it. Aggregators (NewAPI,
 * SiliconFlow, OpenRouter-likes) host many vendors under one provider, which is
 * exactly where the provider icon is least informative.
 *
 * Returns undefined when nothing matches; callers fall back to the provider icon.
 *
 * Examples:
 *   gpt-4o                    → OpenAI
 *   o3-mini                   → OpenAI
 *   claude-sonnet-4           → Claude
 *   deepseek-ai/DeepSeek-V3.2 → DeepSeek
 *   qwen-2.5-72b-instruct     → Qwen
 *   llama-3.1-8b-instruct     → Meta
 */
export function inferModelIcon(modelId: string): BrandIcon | undefined {
  if (!modelId || !modelId.trim()) return undefined
  for (const [pattern, icon] of RULES) {
    if (pattern.test(modelId)) return icon
  }
  return undefined
}
