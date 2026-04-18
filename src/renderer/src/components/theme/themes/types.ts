/**
 * Shared types for the color theme system.
 * Each CSS variable name maps to an oklch() color string.
 */

export type ColorThemeId = 'default' | 'mint' | 'lavender' | 'ocean' | 'amber' | 'rose'

export interface ThemeColors {
  '--background': string
  '--foreground': string
  '--card': string
  '--card-foreground': string
  '--popover': string
  '--popover-foreground': string
  '--primary': string
  '--primary-foreground': string
  '--secondary': string
  '--secondary-foreground': string
  '--muted': string
  '--muted-foreground': string
  '--accent': string
  '--accent-foreground': string
  '--destructive': string
  '--destructive-foreground': string
  '--border': string
  '--input': string
  '--ring': string
  '--sidebar-background': string
  '--sidebar-foreground': string
  '--sidebar-primary': string
  '--sidebar-primary-foreground': string
  '--sidebar-accent': string
  '--sidebar-accent-foreground': string
  '--sidebar-border': string
  '--sidebar-ring': string
  '--chat-user': string
  '--chat-user-foreground': string
  '--nav-background': string
  '--nav-foreground': string
  '--nav-active': string
}

export interface ColorTheme {
  id: ColorThemeId
  light: ThemeColors
  dark: ThemeColors
  /** Representative colors for the card preview: [primary, secondary, accent] */
  preview: { light: [string, string, string]; dark: [string, string, string] }
}
