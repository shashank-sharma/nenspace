/**
 * Color Feature Types
 * 
 * TypeScript interfaces and types for the colors feature
 */

export interface RGB {
    r: number;
    g: number;
    b: number;
}

export interface HSL {
    h: number;
    s: number;
    l: number;
}

export interface HSV {
    h: number;
    s: number;
    v: number;
}

export interface LAB {
    l: number;
    a: number;
    b: number;
}

export interface Color {
    hex: string;
    rgb: RGB;
    hsl: HSL;
    hsv?: HSV;
    lab?: LAB;
    name?: string;
}

export interface ColorPalette {
    id: string;
    name: string;
    colors: Color[];
    created: string;
    updated: string;
    user: string;
    is_public?: boolean;
    tags?: string[];
    description?: string;
}

export type ColorHarmonyType = 'complementary' | 'triadic' | 'tetradic' | 'analogous' | 'monochromatic' | 'split-complementary';

export interface ColorHarmony {
    type: ColorHarmonyType;
    colors: Color[];
    baseColor: Color;
}

export interface ContrastResult {
    ratio: number;
    level: 'AAA' | 'AA' | 'AA-Large' | 'Fail';
    passes: boolean;
    foreground: Color;
    background: Color;
}

export interface ImageExtractionOptions {
    algorithm: 'dominant' | 'kmeans' | 'simple';
    colorCount: number;
    sampleRate?: number;
}

export interface ExtractedPalette {
    colors: Color[];
    source: string; // Image URL or data URL
    extractionOptions: ImageExtractionOptions;
}

