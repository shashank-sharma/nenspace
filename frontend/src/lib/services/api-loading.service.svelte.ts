/**
 * API Loading Service
 * 
 * Tracks active API requests globally to show loading indicators.
 * 
 * Usage:
 * ```typescript
 * import { ApiLoadingService } from '$lib/services/api-loading.service.svelte';
 * 
 * // Start tracking a request
 * const requestId = ApiLoadingService.startRequest('fetch-users');
 * 
 * // End tracking
 * ApiLoadingService.endRequest(requestId);
 * 
 * // Check if loading
 * if (ApiLoadingService.isLoading) {
 *     // Show loading UI
 * }
 * ```
 */

import { browser } from '$app/environment';
import { emit } from '@tauri-apps/api/event';

class ApiLoadingServiceImpl {
    readonly #activeRequests = $state<Set<string>>(new Set());
    #requestCounter = 0;

    /**
     * Whether any API requests are currently active
     */
    get isLoading(): boolean {
        return this.#activeRequests.size > 0;
    }

    /**
     * Number of active requests
     */
    get activeCount(): number {
        return this.#activeRequests.size;
    }

    /**
     * Start tracking an API request
     * @param label Optional label for debugging
     * @returns Request ID to use when ending the request
     */
    startRequest(label?: string): string {
        this.#requestCounter++;
        const requestId = `req_${this.#requestCounter}_${Date.now()}`;
        this.#activeRequests.add(requestId);
        
        console.log(`[API] ▶ Started (${this.#activeRequests.size} active)${label ? ': ' + label : ''}`);
        
        this.#emitStatusUpdate();
        
        return requestId;
    }

    /**
     * End tracking an API request
     */
    endRequest(requestId: string): void {
        const wasTracking = this.#activeRequests.has(requestId);
        this.#activeRequests.delete(requestId);
        
        if (wasTracking) {
            console.log(`[API] ✓ Ended (${this.#activeRequests.size} active)`);
        }

        this.#emitStatusUpdate();
    }

    /**
     * Clear all tracked requests (for cleanup/reset)
     */
    clearAll(): void {
        const count = this.#activeRequests.size;
        this.#activeRequests.clear();
        if (count > 0) {
            console.log(`[API] 🧹 Cleared ${count} stuck requests`);
        }

        this.#emitStatusUpdate();
    }

    /**
     * Emit status update to floating window via Tauri
     */
    async #emitStatusUpdate(): Promise<void> {
        if (browser && window.__TAURI__) {
            try {
                await emit('api-loading-update', {
                    isLoading: this.isLoading,
                    activeCount: this.activeCount,
                });
            } catch (error) {
                // Silently fail if floating window not available
            }
        }
    }
}

export const ApiLoadingService = new ApiLoadingServiceImpl();
