/**
 * Health Service
 * 
 * Monitors backend health via background script communication using Plasmo messaging.
 */

import { sendToBackground } from '@plasmohq/messaging'
import { createLogger } from '../utils/logger.util';
import type { GetHealthStatusResponse, CheckHealthResponse } from '../types/messages';

const logger = createLogger('[HealthService]');

export interface HealthStatus {
    connected: boolean;
    error: string | null;
    lastChecked: Date | null;
}

class HealthServiceImpl {
    #status: HealthStatus = {
        connected: false,
        error: null,
        lastChecked: null,
    };
    #messageListener: ((message: any) => void) | null = null;
    #isInitialized = false;
    #pendingRequest: Promise<void> | null = null;

    /**
     * Current health status
     */
    get status(): HealthStatus {
        return this.#status;
    }

    /**
     * Start health monitoring (listen to background script updates)
     */
    async startMonitoring(): Promise<void> {
        if (this.#isInitialized) return;

        this.#isInitialized = true;

        this.#messageListener = (message: any) => {
            if (message.type === 'HEALTH_STATUS') {
                const payload = message.payload;
                this.#status = {
                    connected: payload.connected,
                    error: payload.error,
                    lastChecked: payload.lastChecked ? new Date(payload.lastChecked) : null,
                };
            }
        };

        chrome.runtime.onMessage.addListener(this.#messageListener);

        try {
            const tab = await chrome.tabs.getCurrent();
            if (tab?.active) {
                await this.requestHealthCheck();
            }
        } catch (error) {
            // Fallback to request health check even if tab detection fails
            await this.requestHealthCheck();
        }
    }

    /**
     * Stop health monitoring
     */
    stopMonitoring(): void {
        if (this.#messageListener) {
            chrome.runtime.onMessage.removeListener(this.#messageListener);
            this.#messageListener = null;
        }
        this.#isInitialized = false;
        this.#pendingRequest = null;
    }

    pause(): void {
        // Background continues to check, we just don't request updates
    }

    resume(): void {
        this.requestHealthCheck();
    }

    /**
     * Request health check from background script (debounced)
     */
    async requestHealthCheck(): Promise<void> {
        if (this.#pendingRequest) {
            return this.#pendingRequest;
        }

        this.#pendingRequest = (async () => {
            try {
                const response = await sendToBackground<{}, GetHealthStatusResponse>({
                    name: 'get-health-status'
                });
                
                if (response?.success && response.health) {
                    this.#status = {
                        connected: response.health.connected,
                        error: response.health.error,
                        lastChecked: response.health.lastChecked ? new Date(response.health.lastChecked) : null,
                    };
                }
            } catch (error) {
                logger.error('Failed to get health status', error);
            } finally {
                setTimeout(() => {
                    this.#pendingRequest = null;
                }, 100);
            }
        })();

        return this.#pendingRequest;
    }

    async checkHealth(): Promise<void> {
        try {
            await sendToBackground<{}, CheckHealthResponse>({
                name: 'check-health'
            });
        } catch (error) {
            logger.error('Failed to request health check', error);
        }
    }
}

// Export singleton instance
export const HealthService = new HealthServiceImpl();

