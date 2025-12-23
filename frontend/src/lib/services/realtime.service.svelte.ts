/**
 * Realtime Notification Service
 * 
 * Subscribes to backend realtime messages and displays them via IslandNotificationService.
 * This service listens to custom topics from the backend and shows notifications automatically.
 * 
 * Features:
 * - Graceful handling of backend unavailability
 * - Exponential backoff for reconnection attempts
 * - Silent operation when backend is offline
 * - Automatic reconnection when network is restored
 * 
 * Backend sends notifications using:
 * ```go
 * util.NotifyClients(app, "notifications", "Sync completed", "success", 3000)
 * ```
 * 
 * Usage:
 * ```typescript
 * import { RealtimeService } from '$lib/services/realtime.service.svelte';
 * 
 * // Subscribe to a specific topic
 * await RealtimeService.subscribeTopic('notifications');
 * 
 * // Unsubscribe from a topic
 * RealtimeService.unsubscribeTopic('notifications');
 * ```
 */

import { pb } from '$lib/config/pocketbase';
import { NotificationBroadcaster } from '$lib/features/status-indicator';
import { authService } from './authService.svelte';
import { NetworkService } from './network.service.svelte';
import { browser } from '$app/environment';
import { ReconnectionScheduler } from '$lib/utils/reconnect.util';
import type { UnsubscribeFunc } from 'pocketbase';
import { emit } from '@tauri-apps/api/event';

interface RealtimeMessage {
    message: string;
    variant: 'success' | 'error' | 'info' | 'warning' | 'loading';
    duration: number;
}

export type RealtimeConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

class RealtimeServiceImpl {
    readonly #subscriptions = new Map<string, UnsubscribeFunc>();
    #isInitialized = $state(false);
    #connectionStatus = $state<RealtimeConnectionStatus>('disconnected');
    #connectionError = $state<string | null>(null);
    #pendingTopics: string[] = [];
    readonly #reconnectionScheduler: ReconnectionScheduler;

    constructor() {
        // Initialize reconnection scheduler with custom config
        this.#reconnectionScheduler = new ReconnectionScheduler({
            minBackoff: 1000, // 1 second
            maxBackoff: 60000, // 60 seconds
            maxAttempts: 10,
            jitterRange: 1000,
        });

        // Listen for network status changes
        if (browser) {
            window.addEventListener('online', this.#handleNetworkOnline);
        }
    }

    get isInitialized(): boolean {
        return this.#isInitialized;
    }

    get connectionStatus(): RealtimeConnectionStatus {
        return this.#connectionStatus;
    }

    get connectionError(): string | null {
        return this.#connectionError;
    }

    get reconnectAttempts(): number {
        return this.#reconnectionScheduler.attempts;
    }

    get isConnected(): boolean {
        return this.#connectionStatus === 'connected';
    }

    /**
     * Check if backend is likely available
     */
    #isBackendAvailable(): boolean {
        return NetworkService.isOnline;
    }

    /**
     * Handle network coming back online
     */
    readonly #handleNetworkOnline = async () => {
        console.log('[Realtime] Network restored - attempting reconnection');
        
        // Clear any pending reconnect attempts
        this.#reconnectionScheduler.clear();

        // Reset attempts and try to reconnect
        this.#reconnectionScheduler.reset();
        
        if (this.#pendingTopics.length > 0) {
            await this.initialize();
        }
    };

    /**
     * Subscribe to a realtime topic
     */
    async subscribeTopic(topic: string): Promise<void> {
        // Check if backend is available
        if (!this.#isBackendAvailable()) {
            console.log(`[Realtime] Backend unavailable - queueing topic: ${topic}`);
            if (!this.#pendingTopics.includes(topic)) {
                this.#pendingTopics.push(topic);
            }
            this.#connectionStatus = 'disconnected';
            return;
        }

        // Unsubscribe if already subscribed
        if (this.#subscriptions.has(topic)) {
            await this.unsubscribeTopic(topic);
        }

        try {
            this.#connectionStatus = 'connecting';
            this.#connectionError = null;

            const unsubscribe = await pb.realtime.subscribe(topic, async (data: { message?: string; variant?: string; duration?: number }) => {
                // Mark as connected on first message
                if (this.#connectionStatus !== 'connected') {
                    this.#connectionStatus = 'connected';
                    this.#connectionError = null;
                    this.#reconnectionScheduler.reset();
                    console.log('[Realtime] Connection established');
                    
                    // Report success to NetworkService
                    NetworkService.reportSuccess();

                    // Emit to floating window
                    if (browser && window.__TAURI__) {
                        try {
                            await emit('realtime-status-update', {
                                status: this.#connectionStatus,
                                connected: true,
                                error: null,
                            });
                        } catch (error) {
                            // Silently fail if floating window not available
                        }
                    }
                }

                // Parse the message from backend
                const notification = data as RealtimeMessage;

                // Display using NotificationBroadcaster (broadcasts to ALL components)
                if (notification.message) {
                    NotificationBroadcaster.show(
                        notification.message,
                        notification.variant || 'info',
                        { duration: notification.duration || 3000 }
                    );
                }
            });

            // Mark as connected after successful subscription
            this.#connectionStatus = 'connected';
            this.#subscriptions.set(topic, unsubscribe);
            this.#reconnectionScheduler.reset();
            console.log(`[Realtime] Subscribed to topic: ${topic}`);
            
            // Report success to NetworkService
            NetworkService.reportSuccess();
        } catch (error) {
            this.#connectionStatus = 'error';
            this.#connectionError = error instanceof Error ? error.message : 'Connection failed';
            
            // Report failure to NetworkService
            NetworkService.reportFailure();
            
            // Only log errors when backend should be available
            if (this.#isBackendAvailable()) {
                console.warn(`[Realtime] Failed to subscribe to ${topic}:`, error);
            } else {
                console.log(`[Realtime] Connection failed - backend appears offline`);
            }
            
            // Queue topic for retry
            if (!this.#pendingTopics.includes(topic)) {
                this.#pendingTopics.push(topic);
            }

            // Emit to floating window
            if (browser && window.__TAURI__) {
                try {
                    await emit('realtime-status-update', {
                        status: this.#connectionStatus,
                        connected: false,
                        error: this.#connectionError,
                    });
                } catch (err) {
                    // Silently fail if floating window not available
                }
            }
            
            throw error;
        }
    }

    /**
     * Unsubscribe from a realtime topic
     */
    async unsubscribeTopic(topic: string): Promise<void> {
        const unsubscribe = this.#subscriptions.get(topic);
        if (unsubscribe) {
            await unsubscribe();
            this.#subscriptions.delete(topic);
            console.log(`[Realtime] Unsubscribed from topic: ${topic}`);
        }
    }

    /**
     * Initialize default subscriptions for the dashboard
     */
    async initialize(): Promise<void> {
        if (this.#isInitialized) {
            return;
        }

        // Check if backend is available
        if (!this.#isBackendAvailable()) {
            console.log('[Realtime] Backend unavailable - initialization postponed');
            this.#connectionStatus = 'disconnected';
            
            // Store topics to subscribe later
            const userId = authService.user?.id;
            this.#pendingTopics = userId 
                ? [`notifications:${userId}`]
                : ['notifications'];
            
            // Schedule retry with exponential backoff
            this.#reconnectionScheduler.schedule(() => this.reconnect());
            return;
        }

        try {
            this.#connectionStatus = 'connecting';
            
            // Get current user ID for user-specific subscriptions
            const userId = authService.user?.id;
            const topics = userId 
                ? [`notifications:${userId}`]
                : ['notifications'];

            // Try to subscribe to all topics
            let successCount = 0;
            for (const topic of topics) {
                try {
                    await this.subscribeTopic(topic);
                    successCount++;
                } catch (error) {
                    // Individual topic subscription failed, continue with others
                    // Error is already logged in subscribeTopic, just track failure
                    console.log(`[Realtime] Failed to subscribe to ${topic}, will retry later`, error);
                }
            }

            if (successCount > 0) {
                this.#isInitialized = true;
                this.#connectionStatus = 'connected';
                this.#reconnectionScheduler.reset();
                
                // Clear pending topics that were successfully subscribed
                this.#pendingTopics = this.#pendingTopics.filter(t => !this.#subscriptions.has(t));
                
                console.log(`[Realtime] Service initialized with ${successCount}/${topics.length} topics`);
            } else {
                throw new Error('Failed to subscribe to any topics');
            }
        } catch (error) {
            this.#connectionStatus = 'error';
            this.#connectionError = error instanceof Error ? error.message : 'Initialization failed';
            
            // Only show error notification if backend should be available
            if (this.#isBackendAvailable()) {
                console.warn('[Realtime] Initialization failed:', error);
            } else {
                console.log('[Realtime] Initialization failed - backend appears offline');
            }
            
            // Schedule reconnect using scheduler
            this.#reconnectionScheduler.schedule(() => this.reconnect());
        }
    }

    /**
     * Cleanup all subscriptions
     */
    async cleanup(): Promise<void> {
        // Clear any pending reconnect attempts
        this.#reconnectionScheduler.clear();

        for (const topic of this.#subscriptions.keys()) {
            await this.unsubscribeTopic(topic);
        }
        this.#isInitialized = false;
        this.#connectionStatus = 'disconnected';
        this.#connectionError = null;
        console.log('[Realtime] All subscriptions cleaned up');
    }

    /**
     * Retry connection
     */
    async reconnect(): Promise<void> {
        console.log('[Realtime] Attempting to reconnect...');
        this.#isInitialized = false; // Reset initialization flag
        await this.initialize();
    }

    /**
     * Get list of active subscriptions
     */
    getActiveTopics(): string[] {
        return Array.from(this.#subscriptions.keys());
    }

    /**
     * Destroy service and cleanup
     */
    destroy(): void {
        if (browser) {
            window.removeEventListener('online', this.#handleNetworkOnline);
        }
        
        this.#reconnectionScheduler.destroy();
    }
}

// Export singleton instance
export const RealtimeService = new RealtimeServiceImpl();
