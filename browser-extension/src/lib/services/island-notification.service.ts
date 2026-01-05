
import type { ComponentType } from 'svelte';
import { 
    CheckCircle2, 
    XCircle, 
    Info, 
    AlertTriangle, 
    Loader2,
    Bell
} from 'lucide-svelte';
import { getNotificationColors, type NotificationVariant as ColorVariant } from '../utils/notification-colors.util';
import { sanitizeNotificationMessage } from '../utils/sanitize.util';
import { createLogger } from '../utils/logger.util';

export type NotificationVariant = 'success' | 'error' | 'info' | 'warning' | 'loading' | 'default' | 'custom';

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
    #current: IslandNotification | null = null;
    #queue: IslandNotification[] = [];
    #timeoutId: ReturnType<typeof setTimeout> | null = null;
    #subscribers: Set<(notification: IslandNotification | null) => void> = new Set();
    #logger = createLogger('[IslandNotificationService]');

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
     * Subscribe to notification state changes
     * 
     * @param callback - Function called when notification state changes
     * @returns Unsubscribe function
     * 
     * @example
     * ```typescript
     * const unsubscribe = IslandNotificationService.subscribe((notification) => {
     *   console.log('Notification changed:', notification);
     * });
     * 
     * // Later, to unsubscribe:
     * unsubscribe();
     * ```
     */
    subscribe(callback: (notification: IslandNotification | null) => void): () => void {
        this.#subscribers.add(callback);
        // Immediately call with current state
        try {
            callback(this.#current);
        } catch (error) {
            this.#logger.error('Error in notification subscriber', error);
        }
        
        return () => {
            this.#subscribers.delete(callback);
        };
    }

    #notifySubscribers(): void {
        this.#subscribers.forEach((callback) => {
            try {
                callback(this.#current);
            } catch (error) {
                this.#logger.error('Error in notification subscriber', error);
            }
        });
    }

    #validateNotification(notification: IslandNotification): boolean {
        if (!notification.message || notification.message.trim() === '') {
            this.#logger.warn('Invalid notification: empty message');
            return false;
        }
        
        if (notification.duration < 0) {
            this.#logger.warn('Invalid notification: negative duration', { duration: notification.duration });
            return false;
        }
        
        if (!notification.id || notification.id.trim() === '') {
            this.#logger.warn('Invalid notification: missing ID');
            return false;
        }
        
        return true;
    }

    /**
     * Show a notification
     * @param message - The notification message (will be sanitized)
     * @param variant - The notification variant (default: 'info')
     * @param options - Optional configuration
     */
    show(message: string, variant: NotificationVariant = 'info', options: NotificationOptions = {}): void {
        try {
            const sanitizedMessage = sanitizeNotificationMessage(message);
            if (!sanitizedMessage) {
                this.#logger.warn('Cannot show notification: empty message after sanitization');
                return;
            }

            const duration = options.duration ?? 3000;
            if (duration < 0) {
                this.#logger.warn('Invalid duration, using default', { duration });
            }

            const variantColors = this.getVariantColors(variant);
            
            const notification: IslandNotification = {
                id: `notification_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
                message: sanitizedMessage,
                variant,
                icon: options.icon ?? this.#getDefaultIcon(variant),
                duration: Math.max(0, duration),
                backgroundColor: options.backgroundColor ?? variantColors.bg,
                textColor: options.textColor ?? variantColors.text,
            };

            if (!this.#validateNotification(notification)) {
                return;
            }

            if (this.#current) {
                this.#queue.push(notification);
                this.#logger.debug('Notification queued', { id: notification.id, queueLength: this.#queue.length });
            } else {
                this.#display(notification);
            }
        } catch (error) {
            this.#logger.error('Failed to show notification', error);
        }
    }

    success(message: string, options: NotificationOptions = {}): void {
        this.show(message, 'success', options);
    }

    error(message: string, options: NotificationOptions = {}): void {
        this.show(message, 'error', options);
    }

    info(message: string, options: NotificationOptions = {}): void {
        this.show(message, 'info', options);
    }

    warning(message: string, options: NotificationOptions = {}): void {
        this.show(message, 'warning', options);
    }

    loading(message: string, options: NotificationOptions = {}): void {
        this.show(message, 'loading', { duration: 0, ...options });
    }

    default(message: string, options: NotificationOptions = {}): void {
        this.show(message, 'default', options);
    }

    hide(): void {
        try {
            if (this.#timeoutId) {
                clearTimeout(this.#timeoutId);
                this.#timeoutId = null;
            }
            
            const wasShowing = this.#current !== null;
            this.#current = null;
            
            if (wasShowing) {
                this.#notifySubscribers();
            }

            if (this.#queue.length > 0) {
                const next = this.#queue.shift();
                if (next) {
                    this.#display(next);
                }
            }
        } catch (error) {
            this.#logger.error('Failed to hide notification', error);
            this.#timeoutId = null;
            this.#current = null;
            this.#notifySubscribers();
        }
    }

    clear(): void {
        try {
            if (this.#timeoutId) {
                clearTimeout(this.#timeoutId);
                this.#timeoutId = null;
            }
            
            this.#current = null;
            this.#queue = [];
            this.#notifySubscribers();
            
            this.#logger.debug('All notifications cleared');
        } catch (error) {
            this.#logger.error('Failed to clear notifications', error);
            this.#timeoutId = null;
            this.#current = null;
            this.#queue = [];
        }
    }

    #display(notification: IslandNotification): void {
        try {
            if (!this.#validateNotification(notification)) {
                this.#logger.warn('Skipping invalid notification', { id: notification.id });
                return;
            }

            this.#current = notification;
            this.#notifySubscribers();

            if (notification.duration > 0) {
                this.#timeoutId = setTimeout(() => {
                    try {
                        this.hide();
                    } catch (error) {
                        this.#logger.error('Error in auto-dismiss', error);
                        this.#timeoutId = null;
                        this.#current = null;
                        this.#notifySubscribers();
                    }
                }, notification.duration);
            }
            
            this.#logger.debug('Notification displayed', { id: notification.id, variant: notification.variant });
        } catch (error) {
            this.#logger.error('Failed to display notification', error);
        }
    }

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
            case 'default':
                return Bell;
            case 'custom':
                return Bell;
            default:
                return Info;
        }
    }

    /**
     * Get default colors for variant
     * @param variant - The notification variant
     * @returns Color configuration (bg, text, iconColor)
     */
    getVariantColors(variant: NotificationVariant): { bg: string; text: string; iconColor: string } {
        try {
            if (variant === 'custom') {
                return { bg: '#000000', text: '#ffffff', iconColor: '#ffffff' };
            }

            const colors = getNotificationColors(variant as ColorVariant);
            return {
                bg: colors.bg,
                text: colors.text,
                iconColor: colors.iconColor,
            };
        } catch (error) {
            this.#logger.error('Failed to get variant colors', error);
            return { bg: '#1f2937', text: '#ffffff', iconColor: '#ffffff' };
        }
    }
}

export const IslandNotificationService = new IslandNotificationServiceImpl();

