/**
 * Network Service
 * 
 * Tracks browser network connectivity status using navigator.onLine API.
 */

class NetworkServiceImpl {
    #isOffline: boolean = !navigator.onLine;
    #initialized = false;

    /**
     * Whether the browser is offline
     */
    get isOffline(): boolean {
        // Initialize listeners on first access
        if (!this.#initialized) {
            this.#initialize();
        }
        return this.#isOffline;
    }

    /**
     * Whether the browser is online
     */
    get isOnline(): boolean {
        return !this.isOffline;
    }

    #initialize(): void {
        if (this.#initialized) return;

        window.addEventListener('online', this.#handleOnline);
        window.addEventListener('offline', this.#handleOffline);

        this.#initialized = true;
    }

    #handleOnline = (): void => {
        this.#isOffline = false;
    };

    #handleOffline = (): void => {
        this.#isOffline = true;
    };

    cleanup(): void {
        if (!this.#initialized) return;

        window.removeEventListener('online', this.#handleOnline);
        window.removeEventListener('offline', this.#handleOffline);
        this.#initialized = false;
    }
}

// Export singleton instance
export const NetworkService = new NetworkServiceImpl();

