/**
 * Color Contrast Utilities
 * 
 * WCAG contrast ratio calculations for accessibility
 */

import type { Color, ContrastResult, RGB } from '../types';
import { hexToRgb } from './color-conversion.util';

/**
 * Calculate relative luminance of a color
 * Based on WCAG 2.1 specification
 */
function getLuminance(rgb: RGB): number {
    const [r, g, b] = [rgb.r / 255, rgb.g / 255, rgb.b / 255].map(val => {
        return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate contrast ratio between two colors
 * Returns a value between 1 (no contrast) and 21 (maximum contrast)
 */
export function calculateContrastRatio(color1: Color, color2: Color): number {
    const lum1 = getLuminance(color1.rgb);
    const lum2 = getLuminance(color2.rgb);

    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);

    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check contrast compliance for WCAG levels
 */
export function checkContrast(foreground: Color, background: Color): ContrastResult {
    const ratio = calculateContrastRatio(foreground, background);

    let level: ContrastResult['level'] = 'Fail';
    let passes = false;

    if (ratio >= 7.0) {
        level = 'AAA';
        passes = true;
    } else if (ratio >= 4.5) {
        level = 'AA';
        passes = true;
    } else if (ratio >= 3.0) {
        level = 'AA-Large';
        passes = true;
    }

    return {
        ratio: Math.round(ratio * 100) / 100,
        level,
        passes,
        foreground,
        background,
    };
}

/**
 * Find the best text color (black or white) for a given background
 */
export function getBestTextColor(background: Color): Color {
    const black: Color = {
        hex: '#000000',
        rgb: { r: 0, g: 0, b: 0 },
        hsl: { h: 0, s: 0, l: 0 },
    };

    const white: Color = {
        hex: '#FFFFFF',
        rgb: { r: 255, g: 255, b: 255 },
        hsl: { h: 0, s: 0, l: 100 },
    };

    const blackContrast = calculateContrastRatio(black, background);
    const whiteContrast = calculateContrastRatio(white, background);

    return blackContrast > whiteContrast ? black : white;
}

/**
 * Adjust color to meet minimum contrast ratio
 */
export function adjustForContrast(
    foreground: Color,
    background: Color,
    minRatio: number = 4.5
): Color {
    let currentRatio = calculateContrastRatio(foreground, background);

    if (currentRatio >= minRatio) {
        return foreground;
    }

    // Adjust lightness to improve contrast
    const targetLuminance = getLuminance(background.rgb);
    const needsLighter = getLuminance(foreground.rgb) < targetLuminance;

    let adjustedHsl = { ...foreground.hsl };
    const step = needsLighter ? 5 : -5;

    while (currentRatio < minRatio && adjustedHsl.l >= 0 && adjustedHsl.l <= 100) {
        adjustedHsl.l = Math.max(0, Math.min(100, adjustedHsl.l + step));

        const adjustedRgb = {
            r: Math.round((adjustedHsl.l / 100) * 255),
            g: Math.round((adjustedHsl.l / 100) * 255),
            b: Math.round((adjustedHsl.l / 100) * 255),
        };

        const adjustedColor: Color = {
            hex: `#${[adjustedRgb.r, adjustedRgb.g, adjustedRgb.b].map(x => {
                const hex = x.toString(16).padStart(2, '0');
                return hex;
            }).join('')}`,
            rgb: adjustedRgb,
            hsl: adjustedHsl,
        };

        currentRatio = calculateContrastRatio(adjustedColor, background);

        if (currentRatio >= minRatio) {
            return adjustedColor;
        }
    }

    // Fallback: return best text color
    return getBestTextColor(background);
}

