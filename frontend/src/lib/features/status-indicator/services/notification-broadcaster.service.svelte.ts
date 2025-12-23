/**
 * Notification Broadcaster Service
 * 
 * Central notification hub that ensures notifications are delivered to ALL components:
 * - Browser Status Indicator (via IslandNotificationService)
 * - Tauri Floating Widget (via Tauri events)
 * 
 * This service acts as a single source of truth for all notifications,
 * ensuring consistency across different UI components.
 * 
 * Usage:
 * ```typescript
 * import { NotificationBroadcaster } from '$lib/features/status-indicator';
 * 
 * // Send notification to all components
 * NotificationBroadcaster.success('Task completed!');
 * NotificationBroadcaster.error('Failed to save', { duration: 5000 });
 * NotificationBroadcaster.info('Syncing...', { duration: 0 }); // No auto-dismiss
 * ```
 */

import { IslandNotificationService, type NotificationOptions } from './island-notification.service.svelte';
import { browser } from '$app/environment';
import { emit } from '@tauri-apps/api/event';

class NotificationBroadcasterImpl {
    /**
     * Broadcast a notification to all components
     * - Updates IslandNotificationService (for browser StatusIndicator)
     * - Emits Tauri event (for FloatingWidget)
     */
    show(
        message: string,
        variant: 'success' | 'error' | 'info' | 'warning' | 'loading',
        options: NotificationOptions = {}
    ): void {
        if (import.meta.env.DEV) {
            console.log(`[NotificationBroadcaster] Broadcasting: "${message}" (${variant})`);
        }
        
        // 1. Update IslandNotificationService (for browser StatusIndicator)
        IslandNotificationService.show(message, variant, options);

        // 2. Emit to Tauri floating widget (if in Tauri environment)
        // Note: IslandNotificationService already does this, so this is redundant
        // but we keep it as a safety net
        if (browser) {
            // Try to emit - will only work if Tauri API is available
            emit('island-notification', {
                message,
                variant,
                duration: options.duration ?? 3000,
                backgroundColor: options.backgroundColor,
                textColor: options.textColor,
            }).then(() => {
                if (import.meta.env.DEV) {
                    console.log('[NotificationBroadcaster] Emitted to Tauri widget');
                }
            }).catch(() => {
                // Silently fail - not in Tauri or widget not available
            });
        }
    }

    /**
     * Show success notification
     */
    success(message: string, options: NotificationOptions = {}): void {
        this.show(message, 'success', options);
    }

    /**
     * Show error notification
     */
    error(message: string, options: NotificationOptions = {}): void {
        this.show(message, 'error', options);
    }

    /**
     * Show info notification
     */
    info(message: string, options: NotificationOptions = {}): void {
        this.show(message, 'info', options);
    }

    /**
     * Show warning notification
     */
    warning(message: string, options: NotificationOptions = {}): void {
        this.show(message, 'warning', options);
    }

    /**
     * Show loading notification (no auto-dismiss by default)
     */
    loading(message: string, options: NotificationOptions = {}): void {
        this.show(message, 'loading', { duration: 0, ...options });
    }

    /**
     * Hide current notification
     */
    hide(): void {
        IslandNotificationService.hide();
    }

    /**
     * Clear all notifications
     */
    clear(): void {
        IslandNotificationService.clear();
    }

    /**
     * Get current notification (for StatusIndicator to read)
     */
    get current() {
        return IslandNotificationService.current;
    }
}

// Export singleton instance
export const NotificationBroadcaster = new NotificationBroadcasterImpl();

