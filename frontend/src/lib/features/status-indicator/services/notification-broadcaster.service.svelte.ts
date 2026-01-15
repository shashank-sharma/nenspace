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
import { notificationFactory } from '../factories/notification-factory';
import { NotificationQueueService } from './notification-queue.service';
import { IslandController } from './island-controller.service.svelte';
import { notificationRegistry } from '../registry/notification-registry';
import { NotificationSeverity } from '../types/severity.types';
import type { NotificationInstance } from '../types/notification.types';
import * as Views from '../components/views';

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
        NotificationQueueService.clear();
    }

    /**
     * Get current notification (for StatusIndicator to read)
     */
    get current() {
        return IslandNotificationService.current;
    }

    /**
     * Show system notification
     */
    system(
        message: string,
        systemType: 'update' | 'maintenance' | 'alert' | 'info' = 'info',
        options?: {
            severity?: NotificationSeverity;
            duration?: number;
            version?: string;
            actionUrl?: string;
        }
    ): void {
        const notification = notificationFactory.createSystem(message, systemType, options);
        this.showNotification(notification);
    }

    /**
     * Show calendar notification
     */
    calendar(
        eventId: string,
        title: string,
        startTime: Date,
        options?: {
            severity?: NotificationSeverity;
            duration?: number;
            endTime?: Date;
            location?: string;
            description?: string;
        }
    ): void {
        const notification = notificationFactory.createCalendar(eventId, title, startTime, options);
        this.showNotification(notification);
    }

    /**
     * Show task notification
     */
    task(
        taskId: string,
        title: string,
        taskType: 'completed' | 'due' | 'overdue' | 'progress',
        options?: {
            severity?: NotificationSeverity;
            duration?: number;
            dueDate?: Date;
            progress?: number;
        }
    ): void {
        const notification = notificationFactory.createTask(taskId, title, taskType, options);
        this.showNotification(notification);
    }

    /**
     * Show big text notification
     */
    bigText(
        text: string,
        options?: {
            severity?: NotificationSeverity;
            duration?: number;
            subtext?: string;
            icon?: any;
        }
    ): void {
        const notification = notificationFactory.createBigText(text, options);
        this.showNotification(notification);
    }

    /**
     * Batch multiple notifications
     */
    batch(
        type: 'standard' | 'system' | 'calendar' | 'task' | 'email',
        notifications: Array<{
            message: string;
            payload?: any;
            severity?: NotificationSeverity;
        }>
    ): void {
        // Add all notifications to queue (they will be batched automatically)
        notifications.forEach(notif => {
            let notification: NotificationInstance;
            
            switch (type) {
                case 'standard':
                    notification = notificationFactory.createStandard('info', notif.message, {
                        severity: notif.severity,
                    });
                    break;
                case 'system':
                    notification = notificationFactory.createSystem(notif.message, 'info', {
                        severity: notif.severity,
                    });
                    break;
                case 'calendar':
                    // Requires more specific data, skip for now
                    return;
                case 'task':
                    // Requires more specific data, skip for now
                    return;
                case 'email':
                    // Requires more specific data, skip for now
                    return;
                default:
                    return;
            }
            
            NotificationQueueService.enqueue(notification);
        });
        
        // Process queue
        this.processQueue();
    }

    /**
     * Internal: Show notification instance
     */
    private showNotification(notification: NotificationInstance): void {
        // Add to queue
        NotificationQueueService.enqueue(notification);
        
        // Process queue
        this.processQueue();
    }

    /**
     * Process notification queue
     */
    private processQueue(): void {
        const next = NotificationQueueService.peek();
        if (!next) return;

        // Check if it's a batched notification
        if ('count' in next && next.count > 1) {
            // Show batched notification
            const batch = next as any;
            const typeConfig = notificationRegistry.get(batch.type);
            if (!typeConfig) return;

            IslandController.show({
                id: `batch_${batch.key}`,
                priority: batch.priority,
                dimensions: typeConfig.dimensions,
                component: typeConfig.viewComponent,
                props: {
                    ...batch.latest.payload,
                    batchCount: batch.count,
                    severity: batch.latest.severity,
                },
                duration: batch.latest.duration,
            });
        } else {
            // Show single notification
            const notification = next as NotificationInstance;
            const typeConfig = notificationRegistry.get(notification.type);
            if (!typeConfig) return;

            IslandController.show({
                id: notification.id,
                priority: typeConfig.priority,
                dimensions: typeConfig.dimensions,
                component: typeConfig.viewComponent,
                props: {
                    ...notification.payload,
                    severity: notification.severity,
                },
                duration: notification.duration,
            });
        }
    }
}

// Export singleton instance
export const NotificationBroadcaster = new NotificationBroadcasterImpl();

