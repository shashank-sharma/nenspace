/**
 * useSyncListener Hook
 * 
 * Listens for sync events and triggers a callback.
 * Automatically handles cleanup in onMount.
 * Eliminates ~10 lines of duplicate code per feature.
 * 
 * @example
 * ```ts
 * onMount(() => {
 *     const cleanup = useSyncListener('tasks-synced', () => loadTasks(true));
 *     return cleanup;
 * });
 * ```
 */

import { browser } from '$app/environment';

export type SyncEventName = string; // Support all event names (tasks-synced, food-log-synced, etc.)

export interface SyncListenerOptions {
    /** Event name to listen for */
    eventName: SyncEventName;
    /** Callback to execute when event fires */
    onSync: () => void | Promise<void>;
    /** Optional: Log messages for debugging */
    debug?: boolean;
}

/**
 * Creates a sync event listener with automatic cleanup
 * @returns Cleanup function to remove the event listener
 */
export function useSyncListener(options: SyncListenerOptions): () => void {
    if (!browser) {
        return () => {}; // No-op on server
    }

    const handleSync = () => {
        if (options.debug) {
            console.log(`🔄 ${options.eventName} fired, executing callback...`);
        }
        options.onSync();
    };

    window.addEventListener(options.eventName, handleSync);

    // Return cleanup function
    return () => {
        window.removeEventListener(options.eventName, handleSync);
    };
}

/**
 * Convenience function for multiple sync listeners
 * @returns Single cleanup function that removes all listeners
 */
export function useMultipleSyncListeners(listeners: SyncListenerOptions[]): () => void {
    const cleanups = listeners.map(listener => useSyncListener(listener));

    return () => {
        cleanups.forEach(cleanup => cleanup());
    };
}
