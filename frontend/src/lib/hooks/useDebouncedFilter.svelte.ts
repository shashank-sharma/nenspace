/**
 * Debounced Filter Hook
 * Debounces filter/search changes to prevent excessive API calls
 */

import { onDestroy } from 'svelte';

/**
 * Hook for debouncing filter changes
 * Automatically skips the initial mount to prevent duplicate API calls
 * 
 * @param filterValue - Function that returns the filter value to track
 * @param callback - Function to call when filter changes (after debounce)
 * @param delayMs - Debounce delay in milliseconds (default: 300)
 * 
 * @example
 * // In TaskFeature.svelte
 * useDebouncedFilter(
 *     () => filter,
 *     () => loadTasks(true),
 *     300
 * );
 * 
 * // Now whenever `filter` changes, `loadTasks` will be called after 300ms
 */
export function useDebouncedFilter<T>(
    filterValue: () => T,
    callback: () => void,
    delayMs = 300
): void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let isInitialMount = true;

    // Effect to watch filter changes
    $effect(() => {
        // Serialize filter to trigger effect on deep changes
        const serialized = JSON.stringify(filterValue());

        // Skip initial mount to prevent duplicate load
        if (isInitialMount) {
            isInitialMount = false;
            return;
        }

        // Clear previous timeout
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        // Set new timeout for debounced callback
        timeoutId = setTimeout(() => {
            callback();
        }, delayMs);
    });

    // Cleanup on component destroy
    onDestroy(() => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    });
}
