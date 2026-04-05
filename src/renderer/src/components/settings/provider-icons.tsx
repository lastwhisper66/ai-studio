import type { ProviderType } from '@shared/types'

import openaiIcon from '@renderer/assets/images/providers/openai.png'
import anthropicIcon from '@renderer/assets/images/providers/anthropic.png'
import geminiIcon from '@renderer/assets/images/providers/gemini.png'
import deepseekIcon from '@renderer/assets/images/providers/deepseek.png'
import siliconIcon from '@renderer/assets/images/providers/silicon.png'
import newapiIcon from '@renderer/assets/images/providers/newapi.png'

/**
 * Map from ProviderType to its brand icon image.
 * Types not listed here will fall back to the letter avatar.
 */
export const PROVIDER_ICON_MAP: Partial<Record<ProviderType, string>> = {
  openai: openaiIcon,
  'openai-response': openaiIcon,
  claude: anthropicIcon,
  anthropic: anthropicIcon,
  gemini: geminiIcon,
  deepseek: deepseekIcon,
  silicon: siliconIcon,
  newapi: newapiIcon,
}
