import type { BrandIcon } from '@renderer/components/settings/provider-icons'

// Deep-path imports — see the comment in provider-icons.tsx for why the barrel
// and `es/<Name>` entry points are both avoided.
import OpenAI from '@lobehub/icons/es/OpenAI/components/Mono'
import Claude from '@lobehub/icons/es/Claude/components/Color'
import Gemini from '@lobehub/icons/es/Gemini/components/Color'
import DeepSeek from '@lobehub/icons/es/DeepSeek/components/Color'
// Kimi, Yuanbao and Monica use Mono, not Color: their Color variants are drawn
// as a white glyph for a dark tile, and lobehub's own AVATAR_BACKGROUND for
// Yuanbao is '#fff', so there is no brand color to put behind them either —
// on a light card they render white-on-white. Mono fills with currentColor and
// tracks the theme's foreground instead.
import Kimi from '@lobehub/icons/es/Kimi/components/Mono'
import Moonshot from '@lobehub/icons/es/Moonshot/components/Mono'
import Qwen from '@lobehub/icons/es/Qwen/components/Color'
import Doubao from '@lobehub/icons/es/Doubao/components/Color'
import ZhiPu from '@lobehub/icons/es/ZhiPu/components/Color'
import Yuanbao from '@lobehub/icons/es/Yuanbao/components/Mono'
import Grok from '@lobehub/icons/es/Grok/components/Mono'
import Perplexity from '@lobehub/icons/es/Perplexity/components/Color'
import Wenxin from '@lobehub/icons/es/Wenxin/components/Color'
import Mistral from '@lobehub/icons/es/Mistral/components/Color'
import Copilot from '@lobehub/icons/es/Copilot/components/Color'
import HuggingFace from '@lobehub/icons/es/HuggingFace/components/Color'
import Poe from '@lobehub/icons/es/Poe/components/Color'
import OpenRouter from '@lobehub/icons/es/OpenRouter/components/Color'
import Groq from '@lobehub/icons/es/Groq/components/Mono'
import AiStudio from '@lobehub/icons/es/AiStudio/components/Mono'
import NotebookLM from '@lobehub/icons/es/NotebookLM/components/Mono'
import Google from '@lobehub/icons/es/Google/components/Color'
import Monica from '@lobehub/icons/es/Monica/components/Mono'
import Dify from '@lobehub/icons/es/Dify/components/Color'
import Coze from '@lobehub/icons/es/Coze/components/Mono'
import Manus from '@lobehub/icons/es/Manus/components/Mono'
import Flowith from '@lobehub/icons/es/Flowith/components/Mono'
import Hunyuan from '@lobehub/icons/es/Hunyuan/components/Color'

/**
 * Host-suffix → brand rules, matched in order.
 *
 * Longer suffixes must come first: `gemini.google.com` has to win before the
 * bare `google.com` catch-all is reached.
 *
 * Keyed by component rather than a name so the table stays a single source of
 * truth; `MINI_APP_ICONS` below re-exposes it for indexed lookup, which is the
 * access shape `react-hooks/static-components` accepts at a render site.
 */
const HOST_RULES: [string, BrandIcon][] = [
  ['chatgpt.com', OpenAI],
  ['openai.com', OpenAI],
  ['claude.ai', Claude],
  ['anthropic.com', Claude],
  ['gemini.google.com', Gemini],
  ['aistudio.google.com', AiStudio],
  ['notebooklm.google.com', NotebookLM],
  ['google.com', Google],
  ['deepseek.com', DeepSeek],
  ['kimi.com', Kimi],
  ['kimi.ai', Kimi],
  ['moonshot.cn', Moonshot],
  ['tongyi.com', Qwen],
  ['qwen.ai', Qwen],
  ['doubao.com', Doubao],
  ['chatglm.cn', ZhiPu],
  ['bigmodel.cn', ZhiPu],
  ['zhipuai.cn', ZhiPu],
  ['yuanbao.tencent.com', Yuanbao],
  ['hunyuan.tencent.com', Hunyuan],
  ['grok.com', Grok],
  ['x.ai', Grok],
  ['perplexity.ai', Perplexity],
  ['yiyan.baidu.com', Wenxin],
  ['mistral.ai', Mistral],
  ['copilot.microsoft.com', Copilot],
  ['github.com', Copilot],
  ['huggingface.co', HuggingFace],
  ['poe.com', Poe],
  ['openrouter.ai', OpenRouter],
  ['groq.com', Groq],
  ['monica.im', Monica],
  ['dify.ai', Dify],
  ['coze.com', Coze],
  ['coze.cn', Coze],
  ['manus.im', Manus],
  ['flowith.io', Flowith],
  // No lobehub.com rule: every LobeHub variant either hardcodes white or is a
  // multi-tone grayscale mark, so none of them survive a light background.
]

/** Matched host suffix → brand icon, for indexed lookup at a render site. */
export const MINI_APP_ICONS: Record<string, BrandIcon> = Object.fromEntries(HOST_RULES)

/**
 * Resolve a mini app URL to the host suffix that identifies its brand.
 *
 * Returns a plain string (not a component) so callers can index
 * `MINI_APP_ICONS` themselves — a component looked up that way keeps a stable
 * identity across renders, and the lookup is trivially testable without
 * touching React.
 *
 * Keyed on the host rather than a stored field, so it works for user-added apps
 * too without a schema change. Returns undefined for anything unrecognized —
 * callers fall back to the app's own glyph on its color.
 */
export function inferMiniAppIconKey(url: string): string | undefined {
  if (!url || !url.trim()) return undefined

  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return undefined
  }

  for (const [suffix] of HOST_RULES) {
    if (host === suffix || host.endsWith(`.${suffix}`)) return suffix
  }
  return undefined
}
