export type { ThemeColors, ColorTheme, ColorThemeId } from './types'

import { defaultTheme } from './default'
import { mintTheme } from './mint'
import { lavenderTheme } from './lavender'
import { amberTheme } from './amber'
import { oceanTheme } from './ocean'
import { roseTheme } from './rose'
import type { ColorTheme, ColorThemeId } from './types'

export { defaultTheme, mintTheme, lavenderTheme, amberTheme, oceanTheme, roseTheme }

export const colorThemes: ColorTheme[] = [
  defaultTheme,
  mintTheme,
  lavenderTheme,
  oceanTheme,
  amberTheme,
  roseTheme,
]

/** Default color theme ID used when none is stored. */
export const DEFAULT_COLOR_THEME_ID: ColorThemeId = 'default'
