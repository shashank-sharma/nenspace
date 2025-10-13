/**
 * Image Loading Utilities
 * Reusable parallel image loading with authentication
 */

import { FileService } from '$lib/services/file-token';

export interface ImageLoadResult {
    id: string;
    url: string | null;
    error?: Error;
}

/**
 * Load multiple images in parallel with authentication
 * 
 * Usage:
 * ```typescript
 * const results = await loadImagesParallel(entries, (entry) => ({
 *     id: entry.id,
 *     baseUrl: FoodLogService.getImageUrl(entry)
 * }));
 * 
 * // Convert to record
 * const imageMap = resultsToRecord(results);
 * ```
 */
export async function loadImagesParallel<T>(
    items: T[],
    getImageData: (item: T) => { id: string; baseUrl: string } | null
): Promise<ImageLoadResult[]> {
    const imagePromises = items
        .map((item) => {
            const imageData = getImageData(item);
            if (!imageData?.baseUrl) return null;

            return loadSingleImage(imageData.id, imageData.baseUrl);
        })
        .filter((promise): promise is Promise<ImageLoadResult> => promise !== null);

    const results = await Promise.allSettled(imagePromises);

    return results.map((result) => {
        if (result.status === 'fulfilled') {
            return result.value;
        } else {
            console.error('Image load failed:', result.reason);
            return {
                id: 'unknown',
                url: null,
                error: result.reason,
            };
        }
    });
}

/**
 * Load a single image with authentication
 */
export async function loadSingleImage(
    id: string,
    baseUrl: string
): Promise<ImageLoadResult> {
    try {
        const url = await FileService.getAuthenticatedFileUrl(baseUrl);
        return { id, url };
    } catch (error) {
        console.error(`Failed to load image ${id}:`, error);
        return {
            id,
            url: null,
            error: error instanceof Error ? error : new Error('Unknown error'),
        };
    }
}

/**
 * Convert array of results to a record/object for easier lookup
 */
export function resultsToRecord(results: ImageLoadResult[]): Record<string, string> {
    const record: Record<string, string> = {};
    
    results.forEach((result) => {
        if (result.url) {
            record[result.id] = result.url;
        }
    });

    return record;
}

/**
 * Merge new image results into existing record
 */
export function mergeImageResults(
    existing: Record<string, string>,
    newResults: ImageLoadResult[]
): Record<string, string> {
    return {
        ...existing,
        ...resultsToRecord(newResults),
    };
}

/**
 * Preload images (browser cache) without authentication
 * Useful for critical images that should load ASAP
 */
export function preloadImages(urls: string[]): void {
    if (typeof window === 'undefined') return;

    urls.forEach((url) => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = url;
        document.head.appendChild(link);
    });
}

/**
 * Image retry configuration
 */
export interface RetryConfig {
    attempts: number;
    baseDelay: number; // in milliseconds
    exponential?: boolean;
}

/**
 * Load image with retry logic
 */
export async function loadImageWithRetry(
    id: string,
    baseUrl: string,
    config: RetryConfig = { attempts: 3, baseDelay: 1000, exponential: true }
): Promise<ImageLoadResult> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < config.attempts; attempt++) {
        try {
            const result = await loadSingleImage(id, baseUrl);
            if (result.url) {
                return result;
            }
        } catch (error) {
            lastError = error instanceof Error ? error : new Error('Unknown error');
            
            // Wait before retry (except on last attempt)
            if (attempt < config.attempts - 1) {
                const delay = config.exponential
                    ? Math.pow(2, attempt) * config.baseDelay
                    : config.baseDelay;
                
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
    }

    return {
        id,
        url: null,
        error: lastError || new Error('Max retry attempts reached'),
    };
}

