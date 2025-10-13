/**
 * Network Service
 * Global reactive service for monitoring online/offline status
 * 
 * Usage:
 * ```typescript
 * import { NetworkService } from '$lib/services/network.service.svelte';
 * 
 * // In component
 * if (!NetworkService.isOnline) {
 *     toast.error('You are offline');
 * }
 * ```
 */

import { browser } from '$app/environment';
import { IslandNotificationService } from './island-notification.service.svelte';
import { emit } from '@tauri-apps/api/event';

class NetworkServiceImpl {
    #isOnline = $state(browser ? navigator.onLine : true);
    #lastOnlineCheck = $state(Date.now());
    #simulateOffline = $state(false);
    #consecutiveFailures = $state(0);

    #originalFetch: typeof fetch | null = null;
    
    // Thresholds
    readonly #MAX_CONSECUTIVE_FAILURES = 3;

    constructor() {
        if (browser) {
            window.addEventListener('online', this.#handleOnline);
            window.addEventListener('offline', this.#handleOffline);

            // Check connectivity on visibility change
            document.addEventListener('visibilitychange', this.#handleVisibilityChange);

            // Install fetch interceptor for offline simulation
            this.#installFetchInterceptor();
        }
    }

    get isOnline() {
        // If simulating offline, always return false
        if (this.#simulateOffline) {
            return false;
        }
        return this.#isOnline;
    }

    get isActuallyOnline() {
        // Get real network status without simulation
        return this.#isOnline;
    }

    get isSimulatingOffline() {
        return this.#simulateOffline;
    }

    get isOffline() {
        // If simulating offline, always return true
        if (this.#simulateOffline) {
            return true;
        }
        return !this.#isOnline;
    }

    get lastOnlineCheck() {
        return this.#lastOnlineCheck;
    }

    get consecutiveFailures() {
        return this.#consecutiveFailures;
    }

    /**
     * Manually check if online (makes actual network request)
     */
    async checkConnectivity(): Promise<boolean> {
        if (!browser) return true;

        // First check navigator.onLine - if it says we're online, trust it
        // This prevents false offline states during tab switches
        if (navigator.onLine) {
            this.#isOnline = true;
            this.#lastOnlineCheck = Date.now();
            this.#resetFailureCount();
            return true;
        }

        // Only do expensive fetch check if navigator.onLine says we're offline
        // to verify it's actually offline
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
            
            const response = await fetch('/favicon.ico', {
                method: 'HEAD',
                cache: 'no-cache',
                signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
            this.#isOnline = response.ok;
            
            if (response.ok) {
                this.#resetFailureCount();
                console.log('🟢 Network check: Online');
            } else {
                console.log('🔴 Network check: Offline');
            }
        } catch (error: unknown) {
            // On fetch failure, we're likely offline
            // But if navigator.onLine is true, trust that instead
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            if (navigator.onLine) {
                console.log('⚠️ Fetch failed but navigator.onLine is true - keeping online state:', errorMessage);
                this.#isOnline = true;
            } else {
                console.log('🔴 Network check failed - marking offline:', errorMessage);
                this.#isOnline = false;
            }
        }

        this.#lastOnlineCheck = Date.now();
        return this.#isOnline;
    }

    /**
     * Report a network failure (called by services when API calls fail)
     */
    reportFailure(): void {
        this.#consecutiveFailures++;
        console.log(`⚠️ Network failure reported (${this.#consecutiveFailures}/${this.#MAX_CONSECUTIVE_FAILURES})`);

        // After multiple failures, assume we're offline
        if (this.#consecutiveFailures >= this.#MAX_CONSECUTIVE_FAILURES && this.#isOnline) {
            console.log('🔴 Multiple network failures detected - switching to offline mode');
            this.#isOnline = false;
            
            // Show "Connection lost" notification (auto-dismiss, but bar stays red)
            IslandNotificationService.error('Connection lost', { duration: 3000 });
        }
    }

    /**
     * Report a successful network request
     */
    reportSuccess(): void {
        const wasOffline = !this.#isOnline;
        
        if (this.#consecutiveFailures > 0) {
            console.log('🟢 Network request succeeded - resetting failure count');
        }
        this.#resetFailureCount();
        
        if (wasOffline) {
            console.log('🟢 Network recovered - switching to online mode');
            this.#isOnline = true;
            
            // Show "Connection restored" notification
            IslandNotificationService.success('Connection restored', { duration: 3000 });
        }
    }

    /**
     * Reset failure count
     */
    #resetFailureCount(): void {
        this.#consecutiveFailures = 0;
    }

    /**
     * Throws an error if offline
     */
    assertOnline(): void {
        if (this.isOffline) {
            throw new Error('You are offline. Please check your internet connection.');
        }
    }

    /**
     * Install fetch interceptor to block requests during offline simulation
     */
    #installFetchInterceptor(): void {
        if (!browser || this.#originalFetch) return;
        
        this.#originalFetch = window.fetch;
        const self = this;
        
        window.fetch = function(...args: Parameters<typeof fetch>): Promise<Response> {
            // Block all API requests when simulating offline
            if (self.#simulateOffline) {
                const input = args[0];
                let url = '';
                
                if (typeof input === 'string') {
                    url = input;
                } else if (input instanceof URL) {
                    url = input.href;
                } else if (input instanceof Request) {
                    url = input.url;
                }
                
                // Block API calls to backend (anything with /api/ or to PocketBase port)
                if (url && (url.includes('/api/') || url.includes(':8090'))) {
                    console.log('🔴 [Offline Simulation] Blocked request to:', url);
                    
                    // Simulate real network error (like Chrome DevTools offline mode)
                    // This mimics what happens when you're actually offline
                    const networkError = new TypeError('Failed to fetch');
                    // Add properties that real network errors have
                    Object.defineProperty(networkError, 'cause', {
                        value: new Error('Simulating offline mode'),
                        enumerable: false
                    });
                    
                    return Promise.reject(networkError);
                }
            }
            
            // Call original fetch
            return self.#originalFetch!.apply(this, args);
        };
    }

    /**
     * Toggle simulated offline mode (for testing)
     */
    toggleSimulateOffline(): void {
        this.#simulateOffline = !this.#simulateOffline;
        console.log(
            this.#simulateOffline
                ? '🔴 Simulating offline mode - Network requests will be blocked'
                : '🟢 Stopped simulating offline mode - Network requests allowed'
        );
        
        // Show island notification
        if (this.#simulateOffline) {
            IslandNotificationService.error('Offline simulation active', { duration: 3000 });
        } else {
            IslandNotificationService.success('Offline simulation disabled', { duration: 3000 });
        }
    }

    /**
     * Set simulated offline mode
     */
    setSimulateOffline(value: boolean): void {
        this.#simulateOffline = value;
        console.log(
            value
                ? '🔴 Simulating offline mode'
                : '🟢 Stopped simulating offline mode'
        );
    }

    destroy() {
        if (browser) {
            window.removeEventListener('online', this.#handleOnline);
            window.removeEventListener('offline', this.#handleOffline);
            document.removeEventListener('visibilitychange', this.#handleVisibilityChange);
            
            // Restore original fetch if we intercepted it
            if (this.#originalFetch) {
                window.fetch = this.#originalFetch;
            }
        }
    }

    readonly #handleOnline = async () => {
        this.#isOnline = true;
        this.#lastOnlineCheck = Date.now();
        this.#resetFailureCount();
        console.log('🟢 Network: Online');
        
        // Show "Back online" notification
        IslandNotificationService.success('Back online', { duration: 3000 });

        // Emit to floating window
        if (browser && window.__TAURI__) {
            try {
                await emit('network-status-update', {
                    isOnline: this.#isOnline,
                    isOffline: !this.#isOnline,
                });
            } catch (error) {
                // Silently fail if floating window not available
            }
        }
    };

    readonly #handleOffline = async () => {
        this.#isOnline = false;
        this.#lastOnlineCheck = Date.now();
        console.log('🔴 Network: Offline');
        
        // Show "Offline mode" notification (auto-dismiss, but bar stays red)
        IslandNotificationService.error('Offline mode', { duration: 3000 });

        // Emit to floating window
        if (browser && window.__TAURI__) {
            try {
                await emit('network-status-update', {
                    isOnline: this.#isOnline,
                    isOffline: !this.#isOnline,
                });
            } catch (error) {
                // Silently fail if floating window not available
            }
        }
    };

    readonly #handleVisibilityChange = () => {
        if (!document.hidden) {
            // Page became visible - immediately sync with navigator.onLine first
            const currentOnlineState = navigator.onLine;
            if (currentOnlineState !== this.#isOnline) {
                console.log(`🔄 Tab visible: navigator.onLine = ${currentOnlineState}, updating state`);
                this.#isOnline = currentOnlineState;
                this.#lastOnlineCheck = Date.now();
            }
            
            // Then do a background connectivity check (doesn't block UI)
            // This is mainly to verify if we're actually offline
            if (!navigator.onLine) {
                this.checkConnectivity();
            }
        }
    };
}

// Export singleton instance
export const NetworkService = new NetworkServiceImpl();

