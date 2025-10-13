/**
 * useAutoRefresh Hook
 * 
 * Manages automatic refresh intervals with proper cleanup.
 * Eliminates ~20 lines of duplicate code per feature.
 * 
 * @example
 * ```ts
 * const { enabled, setEnabled } = useAutoRefresh(() => loadItems(), 30000);
 * ```
 */

import { onDestroy } from 'svelte';

export interface AutoRefreshOptions {
    /** Initial enabled state */
    initialEnabled?: boolean;
    /** Interval in milliseconds */
    intervalMs: number;
    /** Function to call on each refresh */
    refreshFn: () => void | Promise<void>;
}

export function useAutoRefresh(options: AutoRefreshOptions) {
    let enabled = $state(options.initialEnabled ?? false);
    let interval: ReturnType<typeof setInterval> | null = null;

    // Svelte 5: Use $effect for reactive interval management
    $effect(() => {
        if (enabled) {
            interval = setInterval(() => {
                options.refreshFn();
            }, options.intervalMs);
        } else if (interval) {
            clearInterval(interval);
            interval = null;
        }

        // Cleanup on effect re-run or destroy
        return () => {
            if (interval) {
                clearInterval(interval);
                interval = null;
            }
        };
    });

    // Additional cleanup on component destroy
    onDestroy(() => {
        if (interval) {
            clearInterval(interval);
            interval = null;
        }
    });

    return {
        /** Current enabled state */
        get enabled() {
            return enabled;
        },
        /** Set enabled state */
        setEnabled: (value: boolean) => {
            enabled = value;
        },
    };
}
