/**
 * API Loading Service
 * 
 * Tracks global API loading state across the extension.
 */

class ApiLoadingServiceImpl {
    #loadingCount: number = 0;

    /**
     * Whether any API request is currently loading
     */
    get isLoading(): boolean {
        return this.#loadingCount > 0;
    }

    startLoading(): () => void {
        this.#loadingCount++;

        let stopped = false;
        return () => {
            if (stopped) return;
            stopped = true;
            this.stopLoading();
        };
    }

    stopLoading(): void {
        if (this.#loadingCount > 0) {
            this.#loadingCount--;
        }
    }

    reset(): void {
        this.#loadingCount = 0;
    }
}

// Export singleton instance
export const ApiLoadingService = new ApiLoadingServiceImpl();

