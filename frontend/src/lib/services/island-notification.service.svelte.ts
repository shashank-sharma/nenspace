/**
 * Island Notification Service
 * 
 * Global service for displaying island-style notifications at the top center of the screen.
 * Similar to macOS Dynamic Island or native iOS notifications.
 * 
 * Features:
 * - Auto-dismiss with configurable duration
 * - Multiple variants (success, error, info, warning, loading)
 * - Animated transitions
 * - Queue support (shows one at a time)
 * - Programmatic control (show, hide, clear)
 * 
 * Usage:
 * ```typescript
 * import { IslandNotificationService } from '$lib/services/island-notification.service.svelte';
 * 
 * // Simple success
 * IslandNotificationService.success('Task created!');
 * 
 * // Custom duration
 * IslandNotificationService.info('Processing...', { duration: 5000 });
 * 
 * // No auto-dismiss
 * IslandNotificationService.loading('Uploading...', { duration: 0 });
 * 
 * // Manual dismiss
 * IslandNotificationService.hide();
 * ```
 */

import type { ComponentType } from 'svelte';
import { 
    CheckCircle2, 
    XCircle, 
    Info, 
    AlertTriangle, 
    Loader2,
    Bell
} from 'lucide-svelte';
import { browser } from '$app/environment';
import { emit } from '@tauri-apps/api/event';

export type NotificationVariant = 'success' | 'error' | 'info' | 'warning' | 'loading' | 'custom';

export interface IslandNotification {
    id: string;
    message: string;
    variant: NotificationVariant;
    icon?: ComponentType;
    duration: number; // 0 = no auto-dismiss
    backgroundColor?: string;
    textColor?: string;
}

export interface NotificationOptions {
    duration?: number;
    icon?: ComponentType;
    backgroundColor?: string;
    textColor?: string;
}

class IslandNotificationServiceImpl {
    #current = $state<IslandNotification | null>(null);
    #queue: IslandNotification[] = $state([]);
    #timeoutId: NodeJS.Timeout | null = null;

    /**
     * Current notification being displayed
     */
    get current(): IslandNotification | null {
        return this.#current;
    }

    /**
     * Number of notifications in queue
     */
    get queueLength(): number {
        return this.#queue.length;
    }

    /**
     * Show a notification
     */
    show(message: string, variant: NotificationVariant = 'info', options: NotificationOptions = {}): void {
        const notification: IslandNotification = {
            id: `notification_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
            message,
            variant,
            icon: options.icon ?? this.#getDefaultIcon(variant),
            duration: options.duration ?? 3000,
            backgroundColor: options.backgroundColor,
            textColor: options.textColor,
        };

        if (this.#current) {
            // Queue if another notification is showing
            this.#queue.push(notification);
        } else {
            this.#display(notification);
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
     * Show loading notification
     */
    loading(message: string, options: NotificationOptions = {}): void {
        this.show(message, 'loading', { duration: 0, ...options });
    }

    /**
     * Hide current notification
     */
    hide(): void {
        if (this.#timeoutId) {
            clearTimeout(this.#timeoutId);
            this.#timeoutId = null;
        }
        this.#current = null;

        // Show next in queue
        if (this.#queue.length > 0) {
            const next = this.#queue.shift()!;
            this.#display(next);
        }
    }

    /**
     * Clear all notifications (current + queue)
     */
    clear(): void {
        if (this.#timeoutId) {
            clearTimeout(this.#timeoutId);
            this.#timeoutId = null;
        }
        this.#current = null;
        this.#queue = [];
    }

    /**
     * Internal: Display a notification
     */
    #display(notification: IslandNotification): void {
        this.#current = notification;

        // Emit to floating window
        if (browser && window.__TAURI__) {
            emit('island-notification', {
                message: notification.message,
                variant: notification.variant,
                duration: notification.duration,
                backgroundColor: notification.backgroundColor,
                textColor: notification.textColor,
            }).catch(() => {
                // Silently fail if floating window not available
            });
        }

        // Auto-dismiss if duration > 0
        if (notification.duration > 0) {
            this.#timeoutId = setTimeout(() => {
                this.hide();
            }, notification.duration);
        }
    }

    /**
     * Get default icon for variant
     */
    #getDefaultIcon(variant: NotificationVariant): ComponentType {
        switch (variant) {
            case 'success':
                return CheckCircle2;
            case 'error':
                return XCircle;
            case 'info':
                return Info;
            case 'warning':
                return AlertTriangle;
            case 'loading':
                return Loader2;
            case 'custom':
                return Bell;
            default:
                return Info;
        }
    }

    /**
     * Get default colors for variant
     */
    getVariantColors(variant: NotificationVariant): { bg: string; text: string; iconColor: string } {
        switch (variant) {
            case 'success':
                return { bg: 'bg-green-600 dark:bg-green-700', text: 'text-white', iconColor: 'text-green-200' };
            case 'error':
                return { bg: 'bg-red-600 dark:bg-red-700', text: 'text-white', iconColor: 'text-red-200' };
            case 'info':
                return { bg: 'bg-blue-600 dark:bg-blue-700', text: 'text-white', iconColor: 'text-blue-200' };
            case 'warning':
                return { bg: 'bg-yellow-600 dark:bg-yellow-700', text: 'text-white', iconColor: 'text-yellow-200' };
            case 'loading':
                return { bg: 'bg-gray-900 dark:bg-gray-800', text: 'text-white', iconColor: 'text-gray-400' };
            case 'custom':
                return { bg: 'bg-black dark:bg-gray-900', text: 'text-white', iconColor: 'text-white' };
            default:
                return { bg: 'bg-black dark:bg-gray-900', text: 'text-white', iconColor: 'text-white' };
        }
    }
}

// Export singleton instance
export const IslandNotificationService = new IslandNotificationServiceImpl();
