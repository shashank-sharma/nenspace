import { browser } from '$app/environment';
import { IslandPriority } from '../types/island.types';
import { NotificationSeverity, getSeverityConfig } from '../types/severity.types';
import type { 
    NotificationInstance, 
    BatchedNotification, 
    NotificationTypeId,
    NotificationPayload 
} from '../types/notification.types';

/**
 * Notification Queue Service
 * 
 * Manages notification queuing, batching, and priority-based ordering
 */
class NotificationQueueServiceImpl {
    private queue: NotificationInstance[] = [];
    private batches: Map<string, BatchedNotification> = new Map();
    private readonly MAX_QUEUE_SIZE = 50;
    private readonly BATCH_WINDOW_MS = 2000; // 2 seconds to batch similar notifications

    /**
     * Add notification to queue
     */
    enqueue(notification: NotificationInstance): void {
        if (!browser) return;

        // Check if we should batch this notification
        if (this.shouldBatch(notification)) {
            this.addToBatch(notification);
            return;
        }

        // Add to queue
        this.queue.push(notification);
        
        // Sort by priority (highest first)
        this.queue.sort((a, b) => {
            const priorityA = this.calculatePriority(a);
            const priorityB = this.calculatePriority(b);
            return priorityB - priorityA;
        });

        // Enforce max queue size
        if (this.queue.length > this.MAX_QUEUE_SIZE) {
            // Remove lowest priority notifications
            this.queue = this.queue.slice(0, this.MAX_QUEUE_SIZE);
        }
    }

    /**
     * Get next notification from queue
     */
    dequeue(): NotificationInstance | BatchedNotification | null {
        // Check for batched notifications first (they have higher priority)
        if (this.batches.size > 0) {
            const batchesArray = Array.from(this.batches.values());
            batchesArray.sort((a, b) => b.priority - a.priority);
            const batch = batchesArray[0];
            this.batches.delete(batch.key);
            return batch;
        }

        // Get from regular queue
        return this.queue.shift() || null;
    }

    /**
     * Peek at next notification without removing it
     */
    peek(): NotificationInstance | BatchedNotification | null {
        // Check batches first
        if (this.batches.size > 0) {
            const batchesArray = Array.from(this.batches.values());
            batchesArray.sort((a, b) => b.priority - a.priority);
            return batchesArray[0];
        }

        return this.queue[0] || null;
    }

    /**
     * Check if queue is empty
     */
    isEmpty(): boolean {
        return this.queue.length === 0 && this.batches.size === 0;
    }

    /**
     * Get queue size
     */
    get size(): number {
        return this.queue.length + this.batches.size;
    }

    /**
     * Clear all notifications
     */
    clear(): void {
        this.queue = [];
        this.batches.clear();
    }

    /**
     * Remove notification by ID
     */
    remove(id: string): boolean {
        const index = this.queue.findIndex(n => n.id === id);
        if (index !== -1) {
            this.queue.splice(index, 1);
            return true;
        }

        // Check batches
        for (const [key, batch] of this.batches.entries()) {
            const notificationIndex = batch.notifications.findIndex(n => n.id === id);
            if (notificationIndex !== -1) {
                batch.notifications.splice(notificationIndex, 1);
                batch.count = batch.notifications.length;
                
                if (batch.count === 0) {
                    this.batches.delete(key);
                } else {
                    // Update latest notification
                    batch.latest = batch.notifications[batch.notifications.length - 1];
                    batch.priority = this.calculatePriority(batch.latest);
                }
                return true;
            }
        }

        return false;
    }

    /**
     * Get all notifications (for debugging)
     */
    getAll(): Array<NotificationInstance | BatchedNotification> {
        const batchesArray = Array.from(this.batches.values());
        return [...this.queue, ...batchesArray];
    }

    /**
     * Check if notification should be batched
     */
    private shouldBatch(notification: NotificationInstance): boolean {
        // Only batch if notification has a batchKey
        if (!notification.batchKey) return false;

        // Check if there's an existing batch for this key
        const existingBatch = this.batches.get(notification.batchKey);
        if (!existingBatch) return false;

        // Check if batch window is still open (within 2 seconds)
        const timeSinceLatest = Date.now() - existingBatch.latest.timestamp.getTime();
        return timeSinceLatest < this.BATCH_WINDOW_MS;
    }

    /**
     * Add notification to existing batch
     */
    private addToBatch(notification: NotificationInstance): void {
        if (!notification.batchKey) return;

        const batch = this.batches.get(notification.batchKey);
        if (!batch) {
            // Create new batch
            this.batches.set(notification.batchKey, {
                key: notification.batchKey,
                type: notification.type,
                notifications: [notification],
                count: 1,
                latest: notification,
                priority: this.calculatePriority(notification),
            });
            return;
        }

        // Add to existing batch
        batch.notifications.push(notification);
        batch.count = batch.notifications.length;
        batch.latest = notification;
        
        // Update priority to highest severity in batch
        const highestSeverity = Math.max(
            ...batch.notifications.map(n => n.severity)
        );
        batch.priority = this.calculatePriority({
            ...notification,
            severity: highestSeverity as NotificationSeverity,
        });
    }

    /**
     * Calculate priority for notification
     */
    private calculatePriority(notification: NotificationInstance): number {
        const severityConfig = getSeverityConfig(notification.severity);
        const basePriority = this.getBasePriority(notification.type);
        return Math.round(basePriority * severityConfig.priorityMultiplier);
    }

    /**
     * Get base priority for notification type
     */
    private getBasePriority(type: NotificationTypeId): IslandPriority {
        switch (type) {
            case 'system':
                return IslandPriority.SYSTEM;
            case 'big-text':
                return IslandPriority.SYSTEM;
            case 'standard':
                return IslandPriority.NOTIFICATION;
            case 'music':
                return IslandPriority.MUSIC;
            case 'email':
            case 'calendar':
            case 'task':
                return IslandPriority.COMMUNICATION;
            default:
                return IslandPriority.IDLE;
        }
    }
}

export const NotificationQueueService = new NotificationQueueServiceImpl();
