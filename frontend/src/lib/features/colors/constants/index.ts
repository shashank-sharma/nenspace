/**
 * Colors Feature Constants
 */

export const PALETTE_PAGE_SIZE = 20;
export const MAX_PALETTE_COLORS = 20;
export const MIN_PALETTE_COLORS = 1;
export const DEFAULT_COLOR_COUNT = 5;
export const MAX_EXTRACTED_COLORS = 10;

export const COLOR_EXTRACTION_ALGORITHMS = ['dominant', 'kmeans', 'simple'] as const;
export const HARMONY_TYPES = ['complementary', 'triadic', 'tetradic', 'analogous', 'monochromatic', 'split-complementary'] as const;

export const CONTRAST_LEVELS = {
    AAA: 7.0,
    AA: 4.5,
    'AA-Large': 3.0,
} as const;

export { DEFAULT_PALETTES } from './default-palettes';

