/**
 * Debounce Utilities
 * Reusable debounce logic for search, form inputs, etc.
 */

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 * 
 * Usage in Svelte 5:
 * ```typescript
 * import { createDebouncedEffect } from '$lib/utils/debounce.util';
 * 
 * // In component
 * createDebouncedEffect(
 *     () => filter.searchTerm,  // Value to watch
 *     (searchTerm) => {         // Callback when value changes
 *         loadEntries(true);
 *     },
 *     300                        // Delay in ms
 * );
 * ```
 */
export function createDebouncedEffect<T>(
    getValue: () => T,
    callback: (value: T) => void,
    delay: number = 300
): () => void {
    let timeoutId: NodeJS.Timeout;

    const cleanup = () => {
        clearTimeout(timeoutId);
    };

    // Return cleanup function
    return () => {
        const currentValue = getValue();
        clearTimeout(timeoutId);
        
        timeoutId = setTimeout(() => {
            callback(currentValue);
        }, delay);

        // This cleanup runs when effect re-runs or component unmounts
        return cleanup;
    };
}

/**
 * Simple debounce function for regular functions (non-reactive)
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number = 300
): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout;

    return function (this: any, ...args: Parameters<T>) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

/**
 * Throttle function - ensures function is called at most once per delay period
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    delay: number = 300
): (...args: Parameters<T>) => void {
    let lastCall = 0;

    return function (this: any, ...args: Parameters<T>) {
        const now = Date.now();
        if (now - lastCall >= delay) {
            lastCall = now;
            func.apply(this, args);
        }
    };
}

