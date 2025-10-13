import PocketBase from 'pocketbase';
import { ConfigService } from '$lib/services/config.service.svelte';
import { ApiLoadingService } from '$lib/services/api-loading.service.svelte';

// Initialize PocketBase with the URL from our centralized ConfigService.
// This ensures that if the user changes the URL in the debug panel,
// the application will use the new URL after a reload.
export const pb = new PocketBase(ConfigService.pocketbaseUrl.value);

// Track active API requests for loading indicators
// Use a simple queue approach - start request in beforeSend, end the oldest in afterSend
const activeRequestIds: string[] = [];

// Clear any stuck requests on page load (safe to call in both browser and SSR)
ApiLoadingService.clearAll();

// Hook into PocketBase requests to track loading state
pb.beforeSend = function (url, options) {
    // Skip tracking for health checks and background operations
    if (url.includes('/api/health') || url.includes('/api/files/token')) {
        return { url, options };
    }
    
    const requestId = ApiLoadingService.startRequest(`${options.method || 'GET'} ${url}`);
    activeRequestIds.push(requestId);
    
    // Safety: auto-cleanup after 10 seconds in case afterSend doesn't fire
    setTimeout(() => {
        const index = activeRequestIds.indexOf(requestId);
        if (index !== -1) {
            console.warn(`[API] Request auto-cleaned after 10s: ${url}`);
            activeRequestIds.splice(index, 1);
            ApiLoadingService.endRequest(requestId);
        }
    }, 10000);
    
    return { url, options };
};

pb.afterSend = function (response, data) {
    // End the first (oldest) request - FIFO approach
    if (activeRequestIds.length > 0) {
        const requestId = activeRequestIds.shift()!;
        ApiLoadingService.endRequest(requestId);
    }
    
    return data;
};

// The `currentUser` store is no longer needed here.
// The `AuthService` is now the single source of truth for authentication.

// The `backendStatus` store and `checkBackendHealth` function are no longer needed here.
// This logic is now handled by the new `HealthService`.