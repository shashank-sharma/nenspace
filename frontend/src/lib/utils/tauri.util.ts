/**
 * Tauri Environment Detection and Utilities
 */

/**
 * Check if running in Tauri environment
 * Uses __TAURI_INTERNALS__ which is reliable in both dev and production
 */
export const isTauriEnvironment = (): boolean => {
    return typeof (window as any).__TAURI_INTERNALS__ !== "undefined";
};

/**
 * Execute an action only if in Tauri environment
 * Provides error handling and optional fallback value
 */
export const requireTauri = <T>(
    action: () => Promise<T>,
    fallback?: T,
): Promise<T | undefined> => {
    if (!isTauriEnvironment()) return Promise.resolve(fallback);
    return action().catch((err) => {
        if (import.meta.env.DEV) {
            console.error("[Tauri] Operation failed:", err);
        }
        return fallback;
    });
};

/**
 * Type-safe window object with Tauri internals
 */
export interface TauriWindow extends Window {
    __TAURI_INTERNALS__?: {
        metadata?: {
            currentWindow: { label: string };
            currentWebview: { label: string };
        };
    };
}

/**
 * Get typed Tauri window
 */
export const getTauriWindow = (): TauriWindow => window as TauriWindow;

