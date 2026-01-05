/**
 * Design Tokens
 * 
 * Complete design system tokens combining all theme elements.
 * Provides utilities for applying themes to DOM elements.
 */

import type { ThemeName, ThemeToken } from './palette';
import { getThemeColors, STATUS_COLORS } from './colors';
import { FONT_FAMILIES, FONT_SIZES, FONT_WEIGHTS, LINE_HEIGHTS, LETTER_SPACING } from './typography';
import { SPACING, BORDER_RADIUS } from './spacing';
import { SHADOWS, DARK_SHADOWS } from './shadows';

export interface DesignTokens {
    colors: Record<ThemeToken, string>;
    fonts: typeof FONT_FAMILIES;
    fontSizes: typeof FONT_SIZES;
    fontWeights: typeof FONT_WEIGHTS;
    lineHeights: typeof LINE_HEIGHTS;
    letterSpacing: typeof LETTER_SPACING;
    spacing: typeof SPACING;
    borderRadius: typeof BORDER_RADIUS;
    shadows: typeof SHADOWS | typeof DARK_SHADOWS;
    statusColors: typeof STATUS_COLORS;
}

/**
 * Get complete design tokens for a theme
 */
export function getDesignTokens(theme: ThemeName): DesignTokens {
    const isDark = theme === 'dark';
    
    return {
        colors: getThemeColors(theme),
        fonts: FONT_FAMILIES,
        fontSizes: FONT_SIZES,
        fontWeights: FONT_WEIGHTS,
        lineHeights: LINE_HEIGHTS,
        letterSpacing: LETTER_SPACING,
        spacing: SPACING,
        borderRadius: BORDER_RADIUS,
        shadows: isDark ? DARK_SHADOWS : SHADOWS,
        statusColors: STATUS_COLORS,
    };
}

/**
 * Apply theme colors to a DOM element
 */
export function applyThemeToElement(element: HTMLElement, theme: ThemeName): void {
    const colors = getThemeColors(theme);
    
    Object.entries(colors).forEach(([token, value]) => {
        element.style.setProperty(token, value);
    });
    
    // Add data attribute for theme
    element.setAttribute('data-theme', theme);
}

/**
 * Apply theme colors to document root
 * WARNING: Only use this in extension pages (popup, options), NOT in content scripts!
 * For content scripts, use applyThemeToElement with a shadow DOM container instead.
 */
export function applyThemeToDocument(theme: ThemeName): void {
    if (typeof document !== 'undefined') {
        applyThemeToElement(document.documentElement, theme);
    }
}

/**
 * Get CSS variable value for a token
 * WARNING: Always provide an element parameter in content scripts to avoid polluting page CSS!
 * For content scripts, use shadow DOM container elements only.
 */
export function getCSSVariable(token: string, element?: HTMLElement): string {
    // Safety: Require element in content script context, allow documentElement only for extension pages
    const target = element || (typeof window !== 'undefined' && window.location.protocol === 'chrome-extension:' 
        ? document.documentElement 
        : null);
    
    if (!target) {
        console.warn('[getCSSVariable] No element provided and not in extension page context. Returning empty string.');
        return '';
    }
    
    return getComputedStyle(target).getPropertyValue(token).trim();
}

/**
 * Set CSS variable value
 * WARNING: Always provide an element parameter in content scripts to avoid polluting page CSS!
 * For content scripts, use shadow DOM container elements only. Never use this with document.documentElement in content scripts!
 */
export function setCSSVariable(token: string, value: string, element?: HTMLElement): void {
    // Safety: Require element in content script context, allow documentElement only for extension pages
    const target = element || (typeof window !== 'undefined' && window.location.protocol === 'chrome-extension:' 
        ? document.documentElement 
        : null);
    
    if (!target) {
        console.warn('[setCSSVariable] No element provided and not in extension page context. Cannot set CSS variable.');
        return;
    }
    
    target.style.setProperty(token, value);
}

