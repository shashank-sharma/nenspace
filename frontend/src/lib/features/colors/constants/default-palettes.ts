/**
 * Default Color Palettes
 * 
 * Built-in color palettes for users to start with
 */

import type { ColorPalette } from '../types';

export const DEFAULT_PALETTES: Omit<ColorPalette, 'id' | 'user' | 'created' | 'updated'>[] = [
    {
        name: 'Ocean Breeze',
        colors: [
            { hex: '#006994', rgb: { r: 0, g: 105, b: 148 }, hsl: { h: 197, s: 100, l: 29 } },
            { hex: '#00A8CC', rgb: { r: 0, g: 168, b: 204 }, hsl: { h: 192, s: 100, l: 40 } },
            { hex: '#7DD3FC', rgb: { r: 125, g: 211, b: 252 }, hsl: { h: 199, s: 95, l: 74 } },
            { hex: '#BAE6FD', rgb: { r: 186, g: 230, b: 253 }, hsl: { h: 199, s: 96, l: 86 } },
            { hex: '#E0F2FE', rgb: { r: 224, g: 242, b: 254 }, hsl: { h: 199, s: 96, l: 94 } },
        ],
        description: 'Cool ocean-inspired palette',
        tags: ['ocean', 'blue', 'cool'],
    },
    {
        name: 'Sunset Warmth',
        colors: [
            { hex: '#F97316', rgb: { r: 249, g: 115, b: 22 }, hsl: { h: 25, s: 95, l: 53 } },
            { hex: '#FB923C', rgb: { r: 251, g: 146, b: 60 }, hsl: { h: 25, s: 95, l: 61 } },
            { hex: '#FBBF24', rgb: { r: 251, g: 191, b: 36 }, hsl: { h: 43, s: 96, l: 56 } },
            { hex: '#FCD34D', rgb: { r: 252, g: 211, b: 77 }, hsl: { h: 45, s: 96, l: 65 } },
            { hex: '#FEF3C7', rgb: { r: 254, g: 243, b: 199 }, hsl: { h: 45, s: 96, l: 89 } },
        ],
        description: 'Warm sunset colors',
        tags: ['sunset', 'warm', 'orange'],
    },
    {
        name: 'Forest Green',
        colors: [
            { hex: '#166534', rgb: { r: 22, g: 101, b: 52 }, hsl: { h: 142, s: 64, l: 24 } },
            { hex: '#16A34A', rgb: { r: 22, g: 163, b: 74 }, hsl: { h: 142, s: 76, l: 36 } },
            { hex: '#22C55E', rgb: { r: 34, g: 197, b: 94 }, hsl: { h: 142, s: 71, l: 45 } },
            { hex: '#4ADE80', rgb: { r: 74, g: 222, b: 128 }, hsl: { h: 142, s: 68, l: 58 } },
            { hex: '#86EFAC', rgb: { r: 134, g: 239, b: 172 }, hsl: { h: 142, s: 78, l: 73 } },
        ],
        description: 'Natural forest greens',
        tags: ['forest', 'green', 'nature'],
    },
    {
        name: 'Purple Dream',
        colors: [
            { hex: '#6B21A8', rgb: { r: 107, g: 33, b: 168 }, hsl: { h: 271, s: 67, l: 39 } },
            { hex: '#9333EA', rgb: { r: 147, g: 51, b: 234 }, hsl: { h: 271, s: 81, l: 56 } },
            { hex: '#A855F7', rgb: { r: 168, g: 85, b: 247 }, hsl: { h: 271, s: 91, l: 65 } },
            { hex: '#C084FC', rgb: { r: 192, g: 132, b: 252 }, hsl: { h: 271, s: 95, l: 75 } },
            { hex: '#E9D5FF', rgb: { r: 233, g: 213, b: 255 }, hsl: { h: 271, s: 100, l: 92 } },
        ],
        description: 'Rich purple tones',
        tags: ['purple', 'vibrant', 'dream'],
    },
    {
        name: 'Neutral Gray',
        colors: [
            { hex: '#1F2937', rgb: { r: 31, g: 41, b: 55 }, hsl: { h: 215, s: 28, l: 17 } },
            { hex: '#374151', rgb: { r: 55, g: 65, b: 81 }, hsl: { h: 215, s: 19, l: 27 } },
            { hex: '#6B7280', rgb: { r: 107, g: 114, b: 128 }, hsl: { h: 215, s: 12, l: 46 } },
            { hex: '#9CA3AF', rgb: { r: 156, g: 163, b: 175 }, hsl: { h: 215, s: 10, l: 65 } },
            { hex: '#D1D5DB', rgb: { r: 209, g: 213, b: 219 }, hsl: { h: 215, s: 12, l: 84 } },
        ],
        description: 'Professional neutral grays',
        tags: ['neutral', 'gray', 'professional'],
    },
];

