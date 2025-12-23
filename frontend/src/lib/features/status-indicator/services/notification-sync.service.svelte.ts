/**
 * Notification Sync Service
 * 
 * Synchronizes notifications between different UI components:
 * - Listens for broadcast requests from Tauri floating widget
 * - Distributes notifications to all components via NotificationBroadcaster
 * 
 * This service runs ONLY in the main window and acts as a hub for
 * cross-window notification coordination.
 * 
 * Usage:
 * ```typescript
 * import { NotificationSyncService } from '$lib/features/status-indicator';
 * 
 * // Initialize in main layout (once)
 * await NotificationSyncService.initialize();
 * ```
 */

import { browser } from '$app/environment';
import { NotificationBroadcaster } from './notification-broadcaster.service.svelte';

interface BroadcastNotificationPayload {
    message: string;
    variant: 'success' | 'error' | 'info' | 'warning' | 'loading';
    duration?: number;
    backgroundColor?: string;
    textColor?: string;
}

class NotificationSyncServiceImpl {
    #initialized = false;
    #unlisten: (() => void) | null = null;

    /**
     * Initialize the notification sync service
     * Sets up Tauri event listener for broadcast requests
     */
    async initialize(): Promise<void> {
        if (!browser || this.#initialized) return;

        // Try to import Tauri API - this will only work in Tauri environment
        try {
            const { listen } = await import('@tauri-apps/api/event');
            
            if (import.meta.env.DEV) {
                console.log('[NotificationSync] Tauri environment detected, setting up listener...');
            }

            // Listen for broadcast-notification events from any window
            this.#unlisten = await listen<BroadcastNotificationPayload>(
                'broadcast-notification',
                (event) => {
                    const payload = event.payload;
                    
                    if (import.meta.env.DEV) {
                        console.log('[NotificationSync] Received broadcast:', payload);
                    }

                    // Broadcast to all components
                    NotificationBroadcaster.show(
                        payload.message,
                        payload.variant,
                        {
                            duration: payload.duration,
                            backgroundColor: payload.backgroundColor,
                            textColor: payload.textColor,
                        }
                    );
                }
            );

            this.#initialized = true;
            
            if (import.meta.env.DEV) {
                console.log('[NotificationSync] Initialized and listening for broadcast-notification events');
            }
        } catch (error) {
            // Not in Tauri environment or failed to load Tauri APIs
            if (import.meta.env.DEV) {
                console.debug('[NotificationSync] Not in Tauri environment, skipping:', error);
            }
        }
    }

    /**
     * Cleanup the service
     */
    cleanup(): void {
        if (this.#unlisten) {
            this.#unlisten();
            this.#unlisten = null;
        }
        this.#initialized = false;
    }
}

// Export singleton instance
export const NotificationSyncService = new NotificationSyncServiceImpl();

