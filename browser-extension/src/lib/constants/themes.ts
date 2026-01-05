/**
 * Theme Constants
 * 
 * Theme-related constant values.
 */

export const THEMES = {
    LIGHT: 'light',
    DARK: 'dark',
    NATURE: 'nature',
    SYSTEM: 'system',
    AUTO: 'auto',
    MODERN_DARK: 'modern-dark',
} as const;

export type ThemeId = typeof THEMES[keyof typeof THEMES];

