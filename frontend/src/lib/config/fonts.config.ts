/**
 * Font Configuration
 * 
 * Centralized registry of all available fonts in the application.
 * To add a new font, simply add an entry to the fonts array.
 */

export interface FontFile {
    path: string; // Relative to /fonts/
    weight: number | string; // Font weight (400, 700, 'normal', 'bold')
    style?: 'normal' | 'italic';
    format?: 'woff2' | 'woff';
}

export interface FontConfig {
    id: string; // Unique identifier (e.g., 'gilroy', 'heimat-mono')
    name: string; // Display name (e.g., 'Gilroy', 'Heimat Mono')
    family: string; // CSS font-family value
    files: FontFile[]; // Array of font file paths
    fallback: string; // Fallback font stack
}

/**
 * Available fonts configuration
 */
export const fonts: FontConfig[] = [
    {
        id: 'gilroy',
        name: 'Gilroy',
        family: 'Gilroy',
        fallback: 'system-ui, -apple-system, sans-serif',
        files: [
            {
                path: '/fonts/Gilroy.woff2',
                weight: 400,
                style: 'normal',
                format: 'woff2',
            },
            {
                path: '/fonts/Gilroy-Medium.woff2',
                weight: 500,
                style: 'normal',
                format: 'woff2',
            },
            {
                path: '/fonts/Gilroy-Semibold.woff2',
                weight: 600,
                style: 'normal',
                format: 'woff2',
            },
        ],
    },
    {
        id: 'heimat-mono',
        name: 'Heimat Mono',
        family: 'Heimat Mono',
        fallback: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
        files: [
            {
                path: '/fonts/heimat-mono/Heimat Mono.woff',
                weight: 400,
                style: 'normal',
                format: 'woff',
            },
            {
                path: '/fonts/heimat-mono/Heimat Mono Light.woff',
                weight: 300,
                style: 'normal',
                format: 'woff',
            },
            {
                path: '/fonts/heimat-mono/Heimat Mono Bold.woff',
                weight: 700,
                style: 'normal',
                format: 'woff',
            },
        ],
    },
    {
        id: 'inter',
        name: 'Inter',
        family: 'Inter',
        fallback: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        files: [], // System font, no files needed
    },
];

/**
 * Get font configuration by ID
 */
export function getFontConfig(fontId: string): FontConfig | undefined {
    return fonts.find(font => font.id === fontId);
}

/**
 * Get default font ID
 */
export function getDefaultFontId(): string {
    return 'gilroy';
}

/**
 * Check if font has custom files (not system font)
 */
export function hasFontFiles(fontId: string): boolean {
    const config = getFontConfig(fontId);
    return config ? config.files.length > 0 : false;
}

