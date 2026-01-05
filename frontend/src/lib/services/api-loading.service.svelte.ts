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
    #activeRequests = $state<Set<string>>(new Set());
    #requestLabels = new Map<string, string>();
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
     * Get current request IDs for debugging
     */
    get activeRequestIds(): string[] {
        return Array.from(this.#activeRequests);
    }

    /**
     * Get detailed active requests with labels
     */
    get activeRequestsDetailed(): Array<{ id: string; label: string | undefined }> {
        return Array.from(this.#activeRequests).map((id) => ({ id, label: this.#requestLabels.get(id) }));
    }

    /**
     * Get label for a specific request id (for external debuggers)
     */
    getLabelForRequest(requestId: string): string | undefined {
        return this.#requestLabels.get(requestId);
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
        if (label) this.#requestLabels.set(requestId, label);
        
        // Reassign to trigger reactivity on $state(Set)
        this.#activeRequests = new Set(this.#activeRequests);
        
        // console.log(`[API] ▶ Started (${this.#activeRequests.size} active)${label ? ': ' + label : ''}`);
        
        this.#emitStatusUpdate();
        
        return requestId;
    }

    /**
     * End tracking an API request
     */
    endRequest(requestId: string): void {
        const wasTracking = this.#activeRequests.has(requestId);
        const endedLabel = this.#requestLabels.get(requestId);
        this.#activeRequests.delete(requestId);
        this.#requestLabels.delete(requestId);
        
        // Reassign to trigger reactivity on $state(Set)
        this.#activeRequests = new Set(this.#activeRequests);
        
        if (wasTracking) {
            const remaining = this.activeRequestsDetailed;
            // console.log(
            //     `[API] ✓ Ended (${this.#activeRequests.size} active)${endedLabel ? ': ' + endedLabel : ''}`,
            //     remaining.length > 0 ? '\n[API] ▶ Still active:' : '' ,
            //     remaining.length > 0 ? remaining : ''
            // );
        } else {
            console.warn(`[API] ⚠️ Tried to end non-tracked request: ${requestId}`);
        }

        // Force reactivity update and emit
        this.#emitStatusUpdate();
    }

    /**
     * Clear all tracked requests (for cleanup/reset)
     */
    clearAll(): void {
        const count = this.#activeRequests.size;
        this.#activeRequests.clear();
        this.#requestLabels.clear();
        
        // Reassign to trigger reactivity on $state(Set)
        this.#activeRequests = new Set();
        
        if (count > 0) {
            // console.log(`[API] 🧹 Cleared ${count} stuck requests`);
        }

        this.#emitStatusUpdate();
    }

    /**
     * Debug method to log current state
     */
    debugState(): void {
        // console.log(`[API] Debug State:`, {
        //     isLoading: this.isLoading,
        //     activeCount: this.activeCount,
        //     activeRequests: this.activeRequestsDetailed,
        // });
    }

    /**
     * Emit status update to floating window via Tauri
     */
    async #emitStatusUpdate(): Promise<void> {
        if (browser) {
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

// Expose debug method globally for troubleshooting
if (browser && typeof window !== 'undefined') {
    (window as any).debugApiLoading = () => ApiLoadingService.debugState();
}
