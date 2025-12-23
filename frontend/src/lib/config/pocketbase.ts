import PocketBase from 'pocketbase';
import { ConfigService } from '$lib/services/config.service.svelte';
import { ApiLoadingService } from '$lib/services/api-loading.service.svelte';

// Initialize PocketBase with the URL from our centralized ConfigService.
// This ensures that if the user changes the URL in the debug panel,
// the application will use the new URL after a reload.
export const pb = new PocketBase(ConfigService.pocketbaseUrl.value);

// Track active API requests for loading indicators
// Use requestId-based tracking for more reliable cleanup
const activeRequestMap = new Map<string, string>(); // url+timestamp -> requestId

// Clear any stuck requests on page load (safe to call in both browser and SSR)
ApiLoadingService.clearAll();

// Hook into PocketBase requests to track loading state
pb.beforeSend = function (url, options) {
    // Skip tracking for health checks and background operations
    if (url.includes('/api/health') || url.includes('/api/files/token') || url.includes('/api/realtime')) {
        return { url, options };
    }
    
    const method = options.method || 'GET';
    const timestamp = Date.now();
    const requestKey = `${method}:${url}:${timestamp}`;
    
    const requestId = ApiLoadingService.startRequest(`${method} ${url}`);
    activeRequestMap.set(requestKey, requestId);
    
    // Store request key on options for afterSend
    options.requestKey = requestKey;
    
    // Safety: auto-cleanup after 10 seconds in case afterSend doesn't fire
    setTimeout(() => {
        if (activeRequestMap.has(requestKey)) {
            console.warn(`[API] Request auto-cleaned after 10s: ${url}`);
            const staleRequestId = activeRequestMap.get(requestKey)!;
            activeRequestMap.delete(requestKey);
            ApiLoadingService.endRequest(staleRequestId);
        }
    }, 10000);
    
    return { url, options };
};

pb.afterSend = function (response, data, options) {
    // Use the stored request key to end the specific request
    console.log('[API] afterSend called for response:', response, 'data:', data, 'options:', options);
    const requestKey = options?.requestKey;
    if (requestKey && activeRequestMap.has(requestKey)) {
        const requestId = activeRequestMap.get(requestKey)!;
        activeRequestMap.delete(requestKey);
        ApiLoadingService.endRequest(requestId);
    }
    
    return data;
};

// The `currentUser` store is no longer needed here.
// The `AuthService` is now the single source of truth for authentication.

// The `backendStatus` store and `checkBackendHealth` function are no longer needed here.
// This logic is now handled by the new `HealthService`.