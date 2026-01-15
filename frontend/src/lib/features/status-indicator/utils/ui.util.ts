import { STATUS_INDICATOR_CONFIG } from './status-indicator.util';

/**
 * Measure text width without rendering it to the DOM
 */
export function measureTextWidth(text: string, font: string = '500 14px Inter, sans-serif'): number {
    if (typeof document === 'undefined') return 0;
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return text.length * 8; // fallback
    
    context.font = font;
    return context.measureText(text).width;
}

/**
 * Calculate island width based on text content
 * 
 * @param text - The text content to measure
 * @param hasIcon - Whether the view includes an icon
 * @param isBig - Whether this is a big text announcement (uses larger font)
 * @returns Calculated width constrained between COMPACT_WIDTH and MAX_WIDTH
 */
export function calculateIslandWidth(text: string, hasIcon: boolean = true, isBig: boolean = false): number {
    // Use system font stack to match actual rendering
    // 14px for normal (text-sm), 18px for big text (text-lg)
    const fontSize = isBig ? '700 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' : '500 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    const textWidth = measureTextWidth(text, fontSize);
    const iconWidth = hasIcon ? (isBig ? 32 : 24) : 0;
    const gap = isBig ? 16 : 12; // gap-3 = 12px, gap-4 = 16px
    const padding = isBig ? 48 : 32; // px-6 = 48px, px-4 = 32px
    const buffer = 16; // Increased buffer to ensure text fits comfortably with system fonts
    
    const total = textWidth + iconWidth + gap + padding + buffer;
    
    // Use configurable constants for constraints
    const minWidth = STATUS_INDICATOR_CONFIG.DIMENSIONS.COMPACT_WIDTH;
    const maxWidth = isBig 
        ? STATUS_INDICATOR_CONFIG.DIMENSIONS.MAX_WIDTH_BIG_TEXT 
        : STATUS_INDICATOR_CONFIG.DIMENSIONS.MAX_WIDTH;
    
    return Math.min(Math.max(total, minWidth), maxWidth);
}
