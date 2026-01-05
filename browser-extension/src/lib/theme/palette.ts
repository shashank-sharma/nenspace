/**
 * Theme Palette Tokens
 * 
 * Mirrors the frontend's theme system exactly for visual consistency.
 * Defines theme names, token names, and status variants.
 */

export type ThemeName = 'light' | 'dark' | 'nature';

export const STATUS_VARIANTS = ['success', 'error', 'warning', 'info', 'loading', 'default'] as const;
export type StatusVariant = typeof STATUS_VARIANTS[number];

// CSS variable tokens matching frontend theme system
export const THEME_TOKENS: readonly string[] = [
    '--background',
    '--foreground',
    '--muted',
    '--muted-foreground',
    '--popover',
    '--popover-foreground',
    '--card',
    '--card-foreground',
    '--border',
    '--input',
    '--primary',
    '--primary-foreground',
    '--secondary',
    '--secondary-foreground',
    '--accent',
    '--accent-foreground',
    '--destructive',
    '--destructive-foreground',
    '--ring',
    '--completed',
    '--completed-foreground',
    '--sidebar-background',
    '--sidebar-foreground',
    '--sidebar-primary',
    '--sidebar-primary-foreground',
    '--sidebar-accent',
    '--sidebar-accent-foreground',
    '--sidebar-border',
    '--sidebar-ring',
] as const;

export type ThemeToken = typeof THEME_TOKENS[number];

export type PaletteTokenValue = {
    name: ThemeToken;
    hsl: string; // "h s% l%"
    hex: string; // "#RRGGBB"
};

export type ExportedTheme = {
    version: number;
    theme: ThemeName;
    tokens: Record<ThemeToken, string>; // hex
};

