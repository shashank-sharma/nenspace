/**
 * Reconnection Utilities
 * 
 * Reusable logic for services that need reconnection with exponential backoff.
 * Used by RealtimeService and other connection-based services.
 */

/**
 * Reconnection configuration
 */
export interface ReconnectConfig {
    /** Minimum backoff delay in milliseconds */
    minBackoff: number;
    /** Maximum backoff delay in milliseconds */
    maxBackoff: number;
    /** Maximum number of reconnection attempts */
    maxAttempts: number;
    /** Add jitter to prevent thundering herd (milliseconds) */
    jitterRange?: number;
}

/**
 * Default reconnection configuration
 */
export const DEFAULT_RECONNECT_CONFIG: ReconnectConfig = {
    minBackoff: 1000, // 1 second
    maxBackoff: 60000, // 60 seconds
    maxAttempts: 10,
    jitterRange: 1000, // 1 second jitter
};

/**
 * Calculate exponential backoff delay with optional jitter
 */
export function calculateBackoffDelay(
    attempts: number,
    config: ReconnectConfig = DEFAULT_RECONNECT_CONFIG
): number {
    const exponential = Math.min(
        config.minBackoff * Math.pow(2, attempts),
        config.maxBackoff
    );

    // Add jitter to prevent thundering herd problem
    const jitter = config.jitterRange
        ? Math.random() * config.jitterRange
        : 0;

    return exponential + jitter;
}

/**
 * Check if should attempt reconnection
 */
export function shouldReconnect(
    attempts: number,
    config: ReconnectConfig = DEFAULT_RECONNECT_CONFIG
): boolean {
    return attempts < config.maxAttempts;
}

/**
 * Format backoff delay for logging
 */
export function formatBackoffTime(delayMs: number): string {
    if (delayMs < 1000) {
        return `${delayMs}ms`;
    }
    return `${Math.round(delayMs / 1000)}s`;
}

/**
 * Create reconnection scheduler
 */
export class ReconnectionScheduler {
    #timeout: NodeJS.Timeout | null = null;
    #attempts = 0;
    readonly #config: ReconnectConfig;

    constructor(config: Partial<ReconnectConfig> = {}) {
        this.#config = { ...DEFAULT_RECONNECT_CONFIG, ...config };
    }

    get attempts(): number {
        return this.#attempts;
    }

    get config(): ReconnectConfig {
        return this.#config;
    }

    /**
     * Schedule a reconnection attempt
     */
    schedule(callback: () => void | Promise<void>): boolean {
        this.clear();

        if (!shouldReconnect(this.#attempts, this.#config)) {
            console.log(
                `[Reconnect] Max attempts (${this.#config.maxAttempts}) reached - giving up`
            );
            return false;
        }

        const delay = calculateBackoffDelay(this.#attempts, this.#config);
        console.log(
            `[Reconnect] Scheduling attempt ${this.#attempts + 1}/${this.#config.maxAttempts} in ${formatBackoffTime(delay)}`
        );

        this.#timeout = setTimeout(async () => {
            this.#timeout = null;
            this.#attempts++;
            await callback();
        }, delay);

        return true;
    }

    /**
     * Reset attempts counter
     */
    reset(): void {
        this.#attempts = 0;
    }

    /**
     * Clear scheduled reconnection
     */
    clear(): void {
        if (this.#timeout) {
            clearTimeout(this.#timeout);
            this.#timeout = null;
        }
    }

    /**
     * Get next delay without scheduling
     */
    getNextDelay(): number {
        return calculateBackoffDelay(this.#attempts, this.#config);
    }

    /**
     * Check if reconnection is scheduled
     */
    isScheduled(): boolean {
        return this.#timeout !== null;
    }

    /**
     * Destroy scheduler
     */
    destroy(): void {
        this.clear();
        this.#attempts = 0;
    }
}
