import type { ProviderType } from '@shared/types'

// Deep-path imports into the icon leaves, NOT the barrel (`@lobehub/icons`) and
// NOT `es/<Name>` either. Both of those pull in `components/Avatar` and
// `components/Combine`, which reach `features/IconAvatar` -> `antd-style` +
// `@lobehub/ui`. Those are unmet peers here, and installing them is not an
// option: `@lobehub/ui` pins React to ^18 via `@emoji-mart/react` while this
// app runs React 19, and it would drag antd + emotion into a Tailwind/Radix
// codebase. `components/{Color,Mono}` are pure SVG and only import react.
import OpenAIIcon from '@lobehub/icons/es/OpenAI/components/Mono'
import AzureIcon from '@lobehub/icons/es/Azure/components/Color'
import AnthropicIcon from '@lobehub/icons/es/Anthropic/components/Mono'
import ClaudeIcon from '@lobehub/icons/es/Claude/components/Color'
import GeminiIcon from '@lobehub/icons/es/Gemini/components/Color'
import DeepSeekIcon from '@lobehub/icons/es/DeepSeek/components/Color'
import SiliconCloudIcon from '@lobehub/icons/es/SiliconCloud/components/Color'
import NewAPIIcon from '@lobehub/icons/es/NewAPI/components/Color'

/** Shape of a lobehub icon component. */
export type BrandIcon = React.ComponentType<{
  size?: number | string
  style?: React.CSSProperties
  className?: string
}>

/**
 * Map from ProviderType to its lobehub brand icon.
 *
 * `Color` is used wherever the brand ships one. OpenAI and Anthropic have no
 * Color variant upstream — their marks are monochrome by design — so they use
 * `Mono`, which fills with `currentColor` and therefore tracks the theme's
 * foreground color automatically in both light and dark mode.
 */
export const PROVIDER_ICON_MAP: Partial<Record<ProviderType, BrandIcon>> = {
  openai: OpenAIIcon,
  'openai-response': OpenAIIcon,
  azure: AzureIcon,
  anthropic: AnthropicIcon,
  claude: ClaudeIcon,
  gemini: GeminiIcon,
  deepseek: DeepSeekIcon,
  silicon: SiliconCloudIcon,
  newapi: NewAPIIcon,
}
