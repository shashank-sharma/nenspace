import type { ComponentType } from 'svelte';
import { 
    CheckCircle2, 
    XCircle, 
    Info, 
    AlertTriangle, 
    Loader2,
    Bell,
    Calendar,
    CheckSquare,
    Mail,
    Music,
    Sparkles,
    AlertCircle,
    Wrench,
    Clock
} from 'lucide-svelte';
import { IslandPriority } from '../types/island.types';
import { NotificationSeverity } from '../types/severity.types';
import type { NotificationType, NotificationTypeId } from '../types/notification.types';
import { getNotificationColors } from '../utils/notification-colors.util';
import NotificationView from '../components/views/NotificationView.svelte';
import SystemView from '../components/views/SystemView.svelte';
import CalendarView from '../components/views/CalendarView.svelte';
import TaskView from '../components/views/TaskView.svelte';
import EmailView from '../components/views/EmailView.svelte';
import MusicView from '../components/views/MusicView.svelte';
import BigTextView from '../components/views/BigTextView.svelte';
import type { NotificationPayload } from '../types/notification.types';

/**
 * Notification Type Registry
 * 
 * Central registry for all notification types with their configurations
 */
class NotificationRegistry {
    private types: Map<NotificationTypeId, NotificationType> = new Map();

    constructor() {
        this.registerBuiltInTypes();
    }

    /**
     * Register a notification type
     */
    register(type: NotificationType): void {
        this.types.set(type.id, type);
    }

    /**
     * Get notification type by ID
     */
    get(id: NotificationTypeId): NotificationType | undefined {
        return this.types.get(id);
    }

    /**
     * Get all registered types
     */
    getAll(): NotificationType[] {
        return Array.from(this.types.values());
    }

    /**
     * Check if type is registered
     */
    has(id: NotificationTypeId): boolean {
        return this.types.has(id);
    }

    /**
     * Register built-in notification types
     */
    private registerBuiltInTypes(): void {
        // Standard notifications (success, error, info, warning, loading)
        this.register({
            id: 'standard',
            priority: IslandPriority.NOTIFICATION,
            defaultSeverity: NotificationSeverity.MEDIUM,
            defaultDuration: 3000,
            viewComponent: NotificationView,
            defaultIcon: Info,
            colors: getNotificationColors('info'),
            canBatch: true,
            batchKey: (payload) => {
                // Batch by message content (same message = same batch)
                return `standard:${payload.message}`;
            },
            canExpand: false,
            maxBatchSize: 5,
        });

        // System notifications
        this.register({
            id: 'system',
            priority: IslandPriority.SYSTEM,
            defaultSeverity: NotificationSeverity.HIGH,
            defaultDuration: 8000,
            viewComponent: SystemView,
            defaultIcon: AlertCircle,
            colors: getNotificationColors('warning'),
            canBatch: true,
            batchKey: (payload) => {
                // Batch by type (update, maintenance, etc.)
                return `system:${payload.type || 'default'}`;
            },
            canExpand: true,
            maxBatchSize: 3,
        });

        // Calendar notifications
        this.register({
            id: 'calendar',
            priority: IslandPriority.COMMUNICATION,
            defaultSeverity: NotificationSeverity.MEDIUM,
            defaultDuration: 5000,
            viewComponent: CalendarView,
            defaultIcon: Calendar,
            colors: getNotificationColors('info'),
            canBatch: true,
            batchKey: (payload) => {
                // Batch by event ID or time window
                if ('eventId' in payload) {
                    return `calendar:${payload.eventId}`;
                }
                return `calendar:${payload.message}`;
            },
            canExpand: true,
            maxBatchSize: 5,
        });

        // Task notifications
        this.register({
            id: 'task',
            priority: IslandPriority.COMMUNICATION,
            defaultSeverity: NotificationSeverity.MEDIUM,
            defaultDuration: 4000,
            viewComponent: TaskView,
            defaultIcon: CheckSquare,
            colors: getNotificationColors('success'),
            canBatch: true,
            batchKey: (payload) => {
                // Batch by task type (completed, due, etc.)
                if ('type' in payload) {
                    return `task:${payload.type}`;
                }
                return `task:${payload.message}`;
            },
            canExpand: true,
            maxBatchSize: 10,
        });

        // Email notifications
        this.register({
            id: 'email',
            priority: IslandPriority.COMMUNICATION,
            defaultSeverity: NotificationSeverity.MEDIUM,
            defaultDuration: 6000,
            viewComponent: EmailView,
            defaultIcon: Mail,
            colors: getNotificationColors('info'),
            canBatch: true,
            batchKey: (payload) => {
                // Batch by sender
                if ('sender' in payload) {
                    return `email:${payload.sender}`;
                }
                return `email:${payload.message}`;
            },
            canExpand: true,
            maxBatchSize: 5,
        });

        // Music notifications
        this.register({
            id: 'music',
            priority: IslandPriority.MUSIC,
            defaultSeverity: NotificationSeverity.INFO,
            defaultDuration: 0, // No auto-dismiss for music
            viewComponent: MusicView,
            defaultIcon: Music,
            colors: getNotificationColors('default'),
            canBatch: false,
            canExpand: true,
        });

        // Big text notifications
        this.register({
            id: 'big-text',
            priority: IslandPriority.SYSTEM,
            defaultSeverity: NotificationSeverity.HIGH,
            defaultDuration: 5000,
            viewComponent: BigTextView,
            defaultIcon: Sparkles,
            colors: getNotificationColors('info'),
            canBatch: false,
            canExpand: false,
        });
    }
}

export const notificationRegistry = new NotificationRegistry();
