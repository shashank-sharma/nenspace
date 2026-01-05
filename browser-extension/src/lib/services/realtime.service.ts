/**
 * Realtime Service (Simplified for Extension)
 * 
 * Simplified realtime connection tracking for browser extension context.
 * Tracks connection status but doesn't actually manage PocketBase realtime connection.
 */

import { createLogger } from '../utils/logger.util';

const logger = createLogger('[RealtimeService]');

export type RealtimeConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

class RealtimeServiceImpl {
    #connectionStatus: RealtimeConnectionStatus = 'disconnected';
    #connectionError: string | null = null;

    /**
     * Current connection status
     */
    get connectionStatus(): RealtimeConnectionStatus {
        return this.#connectionStatus;
    }

    /**
     * Whether currently connected
     */
    get isConnected(): boolean {
        return this.#connectionStatus === 'connected';
    }

    /**
     * Connection error message if any
     */
    get connectionError(): string | null {
        return this.#connectionError;
    }

    /**
     * Set connection status
     */
    setStatus(status: RealtimeConnectionStatus, error: string | null = null): void {
        this.#connectionStatus = status;
        this.#connectionError = error;
        
        if (status === 'error') {
            logger.error('Connection error', { error });
        }
    }

    /**
     * Mark as connected
     */
    connect(): void {
        this.setStatus('connected');
    }

    /**
     * Mark as connecting
     */
    connecting(): void {
        this.setStatus('connecting');
    }

    /**
     * Mark as disconnected
     */
    disconnect(): void {
        this.setStatus('disconnected');
    }

    /**
     * Mark as error
     */
    error(message: string): void {
        this.setStatus('error', message);
    }
}

// Export singleton instance
export const RealtimeService = new RealtimeServiceImpl();

