/**
 * Tailwind CSS Integration Utilities
 * 
 * Generate Tailwind config from color palettes
 */

import type { ColorPalette, Color } from '../types';
import { hexToHslValues } from '$lib/utils/color.utils';

/**
 * Generate Tailwind color configuration from a palette
 */
export function generateTailwindConfig(palette: ColorPalette): Record<string, string> {
    const config: Record<string, string> = {};

    palette.colors.forEach((color, index) => {
        const hsl = hexToHslValues(color.hex);
        const key = palette.name.toLowerCase().replace(/\s+/g, '-') + `-${index + 1}`;
        config[key] = `hsl(${hsl})`;
    });

    return config;
}

/**
 * Apply palette colors as CSS custom properties
 */
export function applyPaletteToTheme(palette: ColorPalette, prefix: string = 'palette'): void {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    palette.colors.forEach((color, index) => {
        const hsl = hexToHslValues(color.hex);
        root.style.setProperty(`--${prefix}-${index + 1}`, hsl);
    });
}

/**
 * Generate Tailwind safelist classes for a palette
 */
export function generateTailwindSafelist(palette: ColorPalette): string[] {
    const prefix = palette.name.toLowerCase().replace(/\s+/g, '-');
    return palette.colors.map((_, index) => {
        const colorName = `${prefix}-${index + 1}`;
        return [
            `bg-${colorName}`,
            `text-${colorName}`,
            `border-${colorName}`,
        ];
    }).flat();
}

/**
 * Export palette as Tailwind config snippet
 */
export function exportTailwindConfig(palette: ColorPalette): string {
    const colors = generateTailwindConfig(palette);
    const config = {
        theme: {
            extend: {
                colors,
            },
        },
    };

    return JSON.stringify(config, null, 2);
}

